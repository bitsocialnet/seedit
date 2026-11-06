// Best-effort mirror of directory snapshots from bitsocialnet/lists.
// The vendored Seedit copy is a bootstrap fallback when the remote source is unavailable; clients
// still select the published snapshot's deterministic winner without local failover.
// The 5chan copy holds only the directories whose boards' posts carry 5chan fortune and dice
// markers (see src/lib/utils/fivechan-post-options.ts).
// Set DIRECTORIES_SOURCE_PATH to a local lists checkout (or its seedit-directories folder) for an offline,
// byte-for-byte sync.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { basename, dirname, isAbsolute, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GITHUB_REPOSITORY_API_URL = 'https://api.github.com/repos/bitsocialnet/lists';
const GITHUB_RAW_BASE_URL = 'https://raw.githubusercontent.com/bitsocialnet/lists';
const DIRECTORIES_SOURCE_PATH = process.env.DIRECTORIES_SOURCE_PATH;
const DATA_DIR = join(__dirname, '..', 'src', 'data');
const TIMEOUT_MS = 5000;

// Each mirror copies one lists folder into src/data/<folder>; `files` limits it to those files.
const MIRRORS = [
  { folder: 'seedit-directories' },
  {
    folder: '5chan-directories',
    files: ['5chan-b-directory.json', '5chan-qst-directory.json', '5chan-s5s-directory.json', '5chan-tg-directory.json'],
    // src/lib/utils/fivechan-post-options.ts reads every list's `boards` while posts render, and normalizes each address.
    isValidFile: (json) =>
      isRecord(json) && Array.isArray(json.boards) && json.boards.every((board) => isRecord(board) && (board.address === undefined || typeof board.address === 'string')),
  },
];

// Remote filenames are joined into the output folder, so accept only flat JSON basenames.
const isJsonFile = (fileName) =>
  typeof fileName === 'string' && fileName.endsWith('.json') && !fileName.includes('/') && !fileName.includes('\\') && !fileName.includes('..');
const isMirroredFile = (mirror, fileName) => isJsonFile(fileName) && (!mirror.files || mirror.files.includes(fileName));
const isRecord = (value) => typeof value === 'object' && value !== null;
const getErrorMessage = (error) => (error instanceof Error ? error.message : String(error));
const getLocalSourcePath = () => (isAbsolute(DIRECTORIES_SOURCE_PATH) ? DIRECTORIES_SOURCE_PATH : resolve(process.cwd(), DIRECTORIES_SOURCE_PATH));
const getSourceLabel = () => (DIRECTORIES_SOURCE_PATH ? `local lists checkout: ${getLocalSourcePath()}` : `GitHub repository: ${GITHUB_REPOSITORY_API_URL}`);

const fetchWithTimeout = async (url, asJson) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return asJson ? response.json() : response.text();
  } finally {
    clearTimeout(timeout);
  }
};

const loadFromLocalCheckout = (checkoutPath, mirror) => {
  const directoryPath = join(checkoutPath, mirror.folder);
  if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) throw new Error(`Local directories folder not found: ${directoryPath}`);
  const files = {};
  for (const fileName of readdirSync(directoryPath).filter((fileName) => isMirroredFile(mirror, fileName))) {
    files[fileName] = readFileSync(join(directoryPath, fileName), 'utf8');
  }
  return files;
};

const getGitHubSnapshotRef = async () => {
  const commit = await fetchWithTimeout(`${GITHUB_REPOSITORY_API_URL}/commits/master`, true);
  if (!isRecord(commit) || typeof commit.sha !== 'string' || !/^[0-9a-f]{40}$/.test(commit.sha)) {
    throw new Error('Invalid GitHub master commit response');
  }
  return commit.sha;
};

const loadFromGitHub = async (snapshotRef, mirror) => {
  const contents = await fetchWithTimeout(`${GITHUB_REPOSITORY_API_URL}/contents/${mirror.folder}?ref=${snapshotRef}`, true);
  if (!Array.isArray(contents)) throw new Error(`Invalid GitHub listing of ${mirror.folder}`);

  const fileNames = contents
    .filter((entry) => isRecord(entry) && entry.type === 'file' && isMirroredFile(mirror, entry.name))
    .map((entry) => entry.name)
    .sort();
  const files = {};
  await Promise.all(
    fileNames.map(async (fileName) => {
      files[fileName] = await fetchWithTimeout(`${GITHUB_RAW_BASE_URL}/${snapshotRef}/${mirror.folder}/${fileName}`, false);
    }),
  );
  return files;
};

// DIRECTORIES_SOURCE_PATH may name the lists checkout or, as before the 5chan mirror, one of its mirrored folders.
const getLocalCheckoutRoot = () => {
  const sourcePath = getLocalSourcePath();
  return MIRRORS.some((mirror) => basename(sourcePath) === mirror.folder) ? dirname(sourcePath) : sourcePath;
};

// Each mirror must be a complete, well-formed snapshot before it replaces its fallback.
const validateMirror = (mirror, files) => {
  const fileNames = Object.keys(files);
  if (fileNames.length === 0) throw new Error(`No ${mirror.folder} files found in source`);
  const missing = mirror.files?.filter((fileName) => !fileNames.includes(fileName));
  if (missing?.length) throw new Error(`Missing ${mirror.folder} files: ${missing.join(', ')}`);
  for (const [fileName, text] of Object.entries(files)) {
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON for ${mirror.folder}/${fileName}`);
    }
    if (mirror.isValidFile && !mirror.isValidFile(json)) throw new Error(`Unexpected format for ${mirror.folder}/${fileName}`);
  }
};

const writeMirror = (mirror, files) => {
  const outputDir = join(DATA_DIR, mirror.folder);
  mkdirSync(outputDir, { recursive: true });
  let written = 0;
  for (const [fileName, text] of Object.entries(files)) {
    const outputPath = join(outputDir, fileName);
    const existing = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : null;
    if (existing === text) continue;
    writeFileSync(outputPath, text, 'utf8');
    written += 1;
  }

  const sourceNames = new Set(Object.keys(files));
  let removed = 0;
  for (const fileName of readdirSync(outputDir).filter(isJsonFile)) {
    if (sourceNames.has(fileName)) continue;
    rmSync(join(outputDir, fileName));
    removed += 1;
  }

  const fileCount = sourceNames.size;
  if (written === 0 && removed === 0) {
    console.log(`Vendored ${mirror.folder} already up to date (${fileCount} files)`);
  } else {
    console.log(`Mirrored ${mirror.folder} (${fileCount} files, ${written} updated, ${removed} removed)`);
  }
};

const sync = async () => {
  let loadMirror;
  try {
    if (DIRECTORIES_SOURCE_PATH) {
      const checkoutRoot = getLocalCheckoutRoot();
      console.log(`Mirroring directories from local lists checkout: ${checkoutRoot}`);
      loadMirror = async (mirror) => loadFromLocalCheckout(checkoutRoot, mirror);
    } else {
      // One commit for every mirror, so they come from the same snapshot.
      const snapshotRef = await getGitHubSnapshotRef();
      console.log(`Mirroring directories from GitHub commit: ${snapshotRef}`);
      loadMirror = (mirror) => loadFromGitHub(snapshotRef, mirror);
    }
  } catch (error) {
    console.warn(`Could not mirror directories from ${getSourceLabel()} (keeping existing files): ${getErrorMessage(error)}`);
    return;
  }

  // The mirrors are unrelated, so one that fails to load or validate keeps only its own fallback.
  await Promise.all(
    MIRRORS.map(async (mirror) => {
      try {
        const files = await loadMirror(mirror);
        validateMirror(mirror, files);
        writeMirror(mirror, files);
      } catch (error) {
        console.warn(`Could not mirror ${mirror.folder} from ${getSourceLabel()} (keeping its existing files): ${getErrorMessage(error)}`);
      }
    }),
  );
};

void sync();
