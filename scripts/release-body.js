import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, readdirSync } from 'fs';
import fetch from 'node-fetch';

const dirname = path.join(path.dirname(fileURLToPath(import.meta.url)));
const changelogPath = path.join(dirname, '..', 'CHANGELOG.md');
const version = JSON.parse(readFileSync(path.join(dirname, '..', 'package.json'), 'utf8')).version;

// `# [0.6.0](compareUrl) (2026-09-16)`, or the same heading without the compare link
const releaseHeadingRegex = /^#{1,4}\s+(?:\[([^\]]+)\]\([^)]*\)|([^\s([]+))\s+\(\d{4}-\d{2}-\d{2}\)\s*$/;

// Read the notes from the committed CHANGELOG.md instead of regenerating them. The changelog's
// prose is hand-maintained after generation (the rebrand rewrote plebbit naming out of it), so a
// fresh conventional-changelog run would publish the raw commit subjects and undo those edits.
const readTopReleaseSection = () => {
  const lines = readFileSync(changelogPath, 'utf8').split('\n');
  const start = lines.findIndex((line) => releaseHeadingRegex.test(line));
  if (start === -1) throw new Error(`${changelogPath} has no release heading`);

  const heading = lines[start].match(releaseHeadingRegex);
  const topVersion = heading[1] || heading[2];
  if (topVersion !== version) {
    throw new Error(`${changelogPath} starts at ${topVersion} but package.json is ${version}; run \`yarn changelog\` first`);
  }

  const offset = lines.slice(start + 1).findIndex((line) => releaseHeadingRegex.test(line));
  const end = offset === -1 ? lines.length : start + 1 + offset;
  return lines.slice(start, end).join('\n');
};

const releaseChangelog = readTopReleaseSection().trim().replace(/\n\n+/g, '\n\n');

// discover artifacts
const distDir = path.join(dirname, '..', 'dist');
let files = [];
try {
  files = readdirSync(distDir);
} catch {}

// In CI finalization, dist is empty. Prefer GitHub release assets when available.
const getReleaseAssetNames = async () => {
  try {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY; // owner/repo
    const tag = process.env.GITHUB_REF_NAME || `v${version}`;
    if (!token || !repo || !tag) return [];
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'seedit-release-notes',
        'X-GitHub-Api-Version': '2022-11-28',
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.assets || []).map((a) => a.name).filter(Boolean);
  } catch (e) {
    return [];
  }
};

const remoteFiles = await getReleaseAssetNames();
if (remoteFiles.length) {
  files = remoteFiles;
}

const linkTo = (file) => `https://github.com/bitsocialnet/seedit/releases/download/v${version}/${file}`;
const has = (s, sub) => s.toLowerCase().includes(sub);
const isArm = (s) => has(s, 'arm64') || has(s, 'aarch64');
const isX64 = (s) => has(s, 'x64') || has(s, 'x86_64') || !isArm(s);

// buckets
const androidApk = files.find((f) => f.endsWith('.apk'));
const htmlZip = files.find((f) => f.includes('seedit-html') && f.endsWith('.zip'));

const linux = files.filter((f) => f.endsWith('.AppImage'));
const mac = files.filter((f) => f.endsWith('.dmg'));
const win = files.filter((f) => f.toLowerCase().endsWith('.exe'));

const linuxArm = linux.find(isArm);
const linuxX64 = linux.find(isX64);
const macArm = mac.find(isArm);
const macX64 = mac.find(isX64);

const winSetupX64 = win.find((f) => has(f, 'setup') && isX64(f));
const winPortableX64 = win.find((f) => has(f, 'portable') && isX64(f));

// small section builder without push()
const section = (title, lines) => {
  const body = lines.filter(Boolean).join('\n');
  return body ? `### ${title}\n${body}` : '';
};

const macSection = section('macOS', [
  macArm && `- Apple Silicon (arm64): [Download DMG](${linkTo(macArm)})`,
  macX64 && `- Intel (x64): [Download DMG](${linkTo(macX64)})`,
  mac.length > 0 &&
    `- If macOS shows "seedit.app is damaged and can't be opened. You should move it to the Trash.", run this in Terminal to fix it: \`xattr -dr com.apple.quarantine "/Applications/seedit.app"\` then open the app again.`,
]);

const winSection = section('Windows', [
  winSetupX64 && `- Installer (x64): [Download EXE](${linkTo(winSetupX64)})`,
  winPortableX64 && `- Portable (x64): [Download EXE](${linkTo(winPortableX64)})`,
  win.length > 0 &&
    `- If Windows shows "Windows protected your PC" (SmartScreen), click "More info" then "Run anyway". To permanently allow, right-click the .exe → Properties → check "Unblock", or run in PowerShell: \`Unblock-File -Path .\\path\\to\\file.exe\`.`,
]);

const linuxSection = section('Linux', [
  linuxArm && `- AppImage (arm64): [Download](${linkTo(linuxArm)})`,
  linuxX64 && `- AppImage (x64): [Download](${linkTo(linuxX64)})`,
]);

const androidSection = section('Android', [androidApk && `- APK: [Download](${linkTo(androidApk)})`]);

const htmlSection = section('Static HTML build', [htmlZip && `- seedit-html (zip): [Download](${linkTo(htmlZip)})`]);

const downloads = [macSection, winSection, linuxSection, androidSection, htmlSection].filter(Boolean).join('\n\n');

const releaseBody = `This release rebrands seedit onto the Bitsocial protocol, adds archive-powered search with an old.reddit-style results page, a redesigned community directory you can search and join, saved posts, and crossposting, connects peer-to-peer by default, and keeps your place in feeds as they update.

- Web app: https://seedit.app
- Decentralized web app via IPFS/IPNS gateways (works on any browser): [seedit.eth.limo](https://seedit.eth.limo), [seedit.eth.link](https://seedit.eth.link), [dweb.link/ipfs.io](https://dweb.link/ipns/seedit.eth)
- Decentralized web app via IPFS node you run: https://seedit.eth (works on [Brave Browser](https://brave.com/) or use [IPFS Companion](https://docs.ipfs.tech/install/ipfs-companion/#prerequisites))

## Downloads

${downloads}

## Changes

${releaseChangelog}`;

console.log(releaseBody);
