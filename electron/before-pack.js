// download the ipfs binaries before building the electron clients

import fs from 'fs-extra';
import ProgressBar from 'progress';
import https from 'https';
import * as tar from 'tar';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import yauzl from 'yauzl';
const ipfsClientsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin');
const ipfsClientWindowsPath = path.join(ipfsClientsPath, 'win');
const ipfsClientMacPath = path.join(ipfsClientsPath, 'mac');
const ipfsClientLinuxPath = path.join(ipfsClientsPath, 'linux');
// Kubo's GitHub releases, not dist.ipfs.tech, which times out from CI runners
const kuboReleaseBaseUrl = 'https://github.com/ipfs/kubo/releases/download';

const ipfsClientVersion = '0.43.0';
// abort a connection that stops sending data so downloadWithRetry can try again
const downloadIdleTimeoutMs = 60 * 1000;

// Resolve the target arch: an explicit arch (forge's target, or the host in dev) wins, then the env override, then the host
const resolveBuildArch = (arch) => {
  if (arch === 'arm64' || arch === 'x64') return arch;
  const envArch = process.env.SEEDIT_BUILD_ARCH;
  if (envArch === 'arm64' || envArch === 'x64') return envArch;
  // fallback to host arch
  if (process.arch === 'arm64') return 'arm64';
  return 'x64';
};

const toKuboArch = (arch) => (arch === 'arm64' ? 'arm64' : 'amd64');

const getKuboUrl = (platform, buildArch) => {
  const arch = toKuboArch(buildArch);
  if (platform === 'win32') return `${kuboReleaseBaseUrl}/v${ipfsClientVersion}/kubo_v${ipfsClientVersion}_windows-${arch}.zip`;
  if (platform === 'darwin') return `${kuboReleaseBaseUrl}/v${ipfsClientVersion}/kubo_v${ipfsClientVersion}_darwin-${arch}.tar.gz`;
  if (platform === 'linux') return `${kuboReleaseBaseUrl}/v${ipfsClientVersion}/kubo_v${ipfsClientVersion}_linux-${arch}.tar.gz`;
  // default to linux
  return `${kuboReleaseBaseUrl}/v${ipfsClientVersion}/kubo_v${ipfsClientVersion}_linux-${arch}.tar.gz`;
};

const downloadWithProgress = (url) =>
  new Promise((resolve, reject) => {
    const split = url.split('/');
    const fileName = split[split.length - 1];
    const chunks = [];
    // a stalled socket never errors on its own. The timeout option arms when the socket is created, so it
    // also bounds DNS lookup and connecting (req.setTimeout waits for the connect); redirects create a new
    // request, so each hop gets it
    const req = https.request(url, { timeout: downloadIdleTimeoutMs });
    req.on('timeout', () => {
      req.destroy(new Error(`Download request for ${url} stalled for ${downloadIdleTimeoutMs / 1000}s`));
    });
    req.on('error', (err) => {
      console.error(`Error making request for ${url}:`, err);
      reject(err);
    });
    req.on('response', (res) => {
      res.on('error', (err) => {
        console.error(`Error in response for ${url}:`, err);
        reject(err);
      });
      // handle redirects
      if (res.statusCode == 301 || res.statusCode === 302) {
        // drain the redirect body so its socket is released
        res.resume();
        resolve(downloadWithProgress(res.headers.location));
        return;
      }

      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`Download request for ${url} failed with status ${res.statusCode ?? 'unknown'}`));
        return;
      }

      const len = parseInt(res.headers['content-length'], 10);
      console.log();
      const bar = new ProgressBar(`  ${fileName} [:bar] :rate/bps :percent :etas`, {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: len,
        stream: process.stdout,
      });
      res.on('data', (chunk) => {
        chunks.push(chunk);
        bar.tick(chunk.length);
      });
      res.on('end', () => {
        console.log('\n');
        resolve(Buffer.concat(chunks));
      });
    });
    req.end();
  });

// add retry wrapper around downloadWithProgress to handle transient network errors
const downloadWithRetry = async (url, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await downloadWithProgress(url);
    } catch (err) {
      console.warn(`Download attempt ${attempt} for ${url} failed:`, err);
      if (attempt === retries) throw err;
      // wait before retrying
      await new Promise((res) => setTimeout(res, attempt * 1000));
    }
  }
};

// unix file type bits, stored in the high 16 bits of a zip entry's external attributes
const unixFileTypeMask = 0o170000;
const unixRegularFile = 0o100000;

// writes one regular-file entry to a path chosen here, so archive entry names never become
// filesystem paths and symlink entries are never created
export const extractZipEntry = async (archivePath, entryName, outputPath) => {
  const zipfile = await yauzl.openPromise(archivePath);
  // eachEntry closes the zip on every exit from the loop
  for await (const entry of zipfile.eachEntry()) {
    if (entry.fileName !== entryName) continue;
    // archives made on Windows leave the unix type bits unset
    const fileType = (entry.externalFileAttributes >>> 16) & unixFileTypeMask;
    if (fileType !== 0 && fileType !== unixRegularFile) {
      throw new Error(`${entryName} in ${archivePath} is not a regular file`);
    }
    await fs.ensureDir(path.dirname(outputPath));
    await pipeline(await zipfile.openReadStreamPromise(entry), fs.createWriteStream(outputPath));
    return;
  }
  throw new Error(`${entryName} not found in ${archivePath}`);
};

const extractArchive = async (archivePath, destinationPath, binName) => {
  if (archivePath.endsWith('.zip')) {
    // the Windows build only ships kubo/<binName>, so extract nothing else
    const entryName = `kubo/${binName}`;
    await extractZipEntry(archivePath, entryName, path.join(destinationPath, entryName));
    return;
  }

  if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
    await tar.x({ file: archivePath, cwd: destinationPath });
    return;
  }

  throw new Error(`Unsupported archive format: ${archivePath}`);
};

// official kubo downloads need to be extracted
const downloadAndExtract = async (url, destinationPath) => {
  let binName = 'ipfs';
  if (destinationPath.endsWith('win')) {
    binName += '.exe';
  }
  const binPath = path.join(destinationPath, binName);
  // bin/<platform>/ipfs is shared by dev and every packaging target, so only reuse it when it came from this exact url
  const sourceMarkerPath = path.join(destinationPath, '.kubo-source');
  const cachedSource = fs.pathExistsSync(sourceMarkerPath) ? fs.readFileSync(sourceMarkerPath, 'utf8').trim() : undefined;
  if (fs.pathExistsSync(binPath) && cachedSource === url) {
    return;
  }
  console.log(`Downloading IPFS client from ${url} to ${destinationPath}`);
  const split = url.split('/');
  const fileName = split[split.length - 1];
  const archivePath = path.join(destinationPath, fileName);
  const extractedPath = path.join(destinationPath, 'kubo');
  const file = await downloadWithRetry(url);
  fs.ensureDirSync(destinationPath);
  await fs.writeFile(archivePath, file);
  console.log(`Downloaded archive to ${archivePath}`);
  console.log(`Extracting ${archivePath} to ${destinationPath}`);
  fs.removeSync(extractedPath);
  try {
    await extractArchive(archivePath, destinationPath, binName);
    console.log('Decompression complete');
  } catch (err) {
    console.error('Error during decompression:', err);
    throw err;
  }
  const extractedBinPath = path.join(extractedPath, binName);
  console.log(`Moving binary from ${extractedBinPath} to ${binPath}`);
  fs.moveSync(extractedBinPath, binPath, { overwrite: true });
  fs.writeFileSync(sourceMarkerPath, `${url}\n`);
  console.log('Binary moved');
  console.log('Cleaning up temporary files');
  fs.removeSync(archivePath);
  fs.removeSync(extractedPath);
  console.log('Cleanup complete');
};

// forge's generateAssets hook passes its target platform/arch; dev passes the host
export const downloadIpfsClients = async ({ platform = process.platform, arch } = {}) => {
  const buildArch = resolveBuildArch(arch);
  console.log(`Starting IPFS client download for platform: ${platform}, targetArch: ${buildArch}`);
  const url = getKuboUrl(platform, buildArch);
  if (platform === 'win32') {
    await downloadAndExtract(url, ipfsClientWindowsPath);
  } else if (platform === 'darwin') {
    await downloadAndExtract(url, ipfsClientMacPath);
  } else if (platform === 'linux') {
    await downloadAndExtract(url, ipfsClientLinuxPath);
  } else {
    console.warn(`Unknown platform: ${platform}, defaulting to linux path`);
    await downloadAndExtract(url, ipfsClientLinuxPath);
  }
};

export default async (_context) => {
  await downloadIpfsClients();
};
