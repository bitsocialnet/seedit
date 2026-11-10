import isDev from 'electron-is-dev';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import ps from 'node:process';
import proxyServer from './proxy-server.js';
import tcpPortUsed from 'tcp-port-used';
import { fileURLToPath, pathToFileURL } from 'url';
import { getPkcDataPath } from './pkc-paths.js';
const dirname = path.join(path.dirname(fileURLToPath(import.meta.url)));
const projectRoot = path.join(dirname, '..');

// Get platform-specific binary name
const getIpfsBinaryName = () => (process.platform === 'win32' ? 'ipfs.exe' : 'ipfs');

// Get platform subdirectory name for bin/ folder
const getPlatformDir = () => {
  if (process.platform === 'win32') return 'win';
  if (process.platform === 'darwin') return 'mac';
  return 'linux';
};

const getBundledKuboPath = (rootPath) => path.join(rootPath, 'bin', getPlatformDir(), getIpfsBinaryName());

const downloadBundledIpfsClients = async () => {
  // before-pack.js is excluded from packaged builds, so only load it in dev.
  const { downloadIpfsClients } = await import('./before-pack.js');
  // a cross-arch package build can leave another arch's binary in bin/, so always ask for the host's
  await downloadIpfsClients({ platform: process.platform, arch: process.arch });
};

// Resolve kubo binary path
const getKuboPath = async () => {
  if (isDev) {
    if (process.env.KUBO_BINARY) {
      return process.env.KUBO_BINARY;
    }

    const bundledKuboPath = getBundledKuboPath(projectRoot);
    // no-op when bin/ already holds the host's binary for the pinned version
    await downloadBundledIpfsClients();

    if (fs.existsSync(bundledKuboPath)) {
      return bundledKuboPath;
    }

    throw new Error(`Kubo binary download completed but '${bundledKuboPath}' was not found`);
  } else {
    // In production, the binary is downloaded to bin/<platform>/ipfs by generateAssets hook,
    // and forge's asar.unpackDir keeps bin/ outside app.asar so it can be spawned
    const appPath = process.resourcesPath;
    const binaryName = getIpfsBinaryName();
    const unpackedPath = path.join(appPath, 'app.asar.unpacked');

    // Try the bin/ directory first (where generateAssets downloads binaries)
    const binDirPath = getBundledKuboPath(unpackedPath);
    if (fs.existsSync(binDirPath)) {
      return binDirPath;
    }

    // Fallback: the kubo npm module's own binary
    const kuboModulePath = path.join(unpackedPath, 'node_modules', 'kubo');

    // Try to import kubo from unpacked location
    try {
      const kuboUrl = pathToFileURL(path.resolve(kuboModulePath)).href;
      const kuboModule = await import(kuboUrl);
      const { path: getKuboBinaryPath } = kuboModule;
      return getKuboBinaryPath();
    } catch {
      // Fallback: try to find the binary directly in kubo module
      const kuboBinPath = path.join(kuboModulePath, 'kubo', binaryName);
      if (fs.existsSync(kuboBinPath)) {
        return kuboBinPath;
      }

      // Last resort: check in resources/app/node_modules/kubo for non-ASAR builds
      const appModulePath = path.join(appPath, 'app', 'node_modules', 'kubo');
      const appKuboBinPath = path.join(appModulePath, 'kubo', binaryName);
      if (fs.existsSync(appKuboBinPath)) {
        return appKuboBinPath;
      }

      throw new Error(`Could not find kubo binary. Checked: ${binDirPath}, ${kuboBinPath}, ${appKuboBinPath}`);
    }
  }
};

// use this custom function instead of spawnSync for better logging
// also spawnSync might have been causing crash on start on windows
const spawnAsync = (...args) =>
  new Promise((resolve, reject) => {
    const spawnedProcess = spawn(...args);
    spawnedProcess.on('exit', (exitCode, signal) => {
      if (exitCode === 0) resolve();
      else reject(Error(`spawnAsync process '${spawnedProcess.pid}' exited with code '${exitCode}' signal '${signal}'`));
    });
    // Always surface errors from short-lived commands
    spawnedProcess.stderr.on('data', (data) => console.error(data.toString()));
    // Short-lived command stdout can be useful in dev, but is noisy in prod
    if (isDev) {
      spawnedProcess.stdout.on('data', (data) => console.log(data.toString()));
    } else {
      // Drain to avoid backpressure without logging
      spawnedProcess.stdout.on('data', () => {});
    }
    // a failed spawn (e.g. EACCES) emits 'error' and never 'exit'
    spawnedProcess.on('error', (error) => {
      console.error(error.toString?.() || String(error));
      reject(error);
    });
  });

const startIpfs = async () => {
  const ipfsPath = await getKuboPath();
  const ipfsDataPath = path.join(getPkcDataPath({ isDev, projectRoot }), 'ipfs');

  if (!fs.existsSync(ipfsPath)) {
    throw Error(`ipfs binary '${ipfsPath}' doesn't exist`);
  }

  console.log({ ipfsPath, ipfsDataPath });

  fs.ensureDirSync(ipfsDataPath);
  // Reduce IPFS daemon log verbosity in production to avoid UI lag from excessive logging
  const env = { ...process.env, IPFS_PATH: ipfsDataPath, ...(isDev ? {} : { GOLOG_LOG_LEVEL: 'error' }) };
  // init ipfs client on first launch
  try {
    await spawnAsync(ipfsPath, ['init'], { env, hideWindows: true });
  } catch {}

  // make sure repo is migrated
  try {
    await spawnAsync(ipfsPath, ['repo', 'migrate'], { env, hideWindows: true });
  } catch {}

  // dont use 8080 port because it's too common
  await spawnAsync(ipfsPath, ['config', '--json', 'Addresses.Gateway', '"/ip4/127.0.0.1/tcp/6473"'], {
    env,
    hideWindows: true,
  });

  // use different port with proxy for debugging during env
  let apiAddress = '/ip4/127.0.0.1/tcp/50019';
  if (isDev) {
    apiAddress = apiAddress.replace('50019', '50029');
    proxyServer.start({ proxyPort: 50019, targetPort: 50029 });
  }
  await spawnAsync(ipfsPath, ['config', 'Addresses.API', apiAddress], { env, hideWindows: true });

  const startIpfsDaemon = () =>
    new Promise((resolve, reject) => {
      const ipfsProcess = spawn(ipfsPath, ['daemon', '--migrate', '--enable-pubsub-experiment', '--enable-namesys-pubsub'], { env, hideWindows: true });
      console.log(`ipfs daemon process started with pid ${ipfsProcess.pid}`);
      let lastError;
      ipfsProcess.stderr.on('data', (data) => {
        lastError = data.toString();
        if (isDev) console.error(lastError);
      });
      ipfsProcess.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        if (isDev) console.log(text);
        if (text.includes('Daemon is ready')) {
          resolve();
        }
      });
      // a failed spawn (e.g. EACCES) emits 'error' and never 'exit'
      ipfsProcess.on('error', (err) => {
        console.error(err?.toString?.() || String(err));
        reject(err);
      });
      ipfsProcess.on('exit', () => {
        console.error(`ipfs process with pid ${ipfsProcess.pid} exited`);
        reject(Error(lastError));
      });
      process.on('exit', () => {
        try {
          ps.kill(ipfsProcess.pid);
        } catch (e) {
          console.log(e);
        }
        try {
          // sometimes ipfs doesnt exit unless we kill pid +1
          ps.kill(ipfsProcess.pid + 1);
        } catch (e) {
          console.log(e);
        }
      });
    });
  await startIpfsDaemon();
};

const DefaultExport = {};
export default DefaultExport;

const startIpfsAutoRestart = async () => {
  let pendingStart = false;
  const start = async () => {
    if (pendingStart) {
      return;
    }
    pendingStart = true;
    try {
      const started = await tcpPortUsed.check(isDev ? 50029 : 50019, '127.0.0.1');
      if (!started) {
        await startIpfs();
        // try to run exported onStarted callback, can be undefined
        DefaultExport.onStarted?.();
      }
    } catch (e) {
      console.log('failed starting ipfs', e);
      try {
        // try to run exported onError callback, can be undefined
        DefaultExport.onError(e)?.catch?.(console.log);
      } catch {}
    }
    pendingStart = false;
  };

  // retry starting ipfs every 1 second,
  // in case it was started by another client that shut down and shut down ipfs with it
  start();
  setInterval(() => {
    start();
  }, 1000);
};
startIpfsAutoRestart();
