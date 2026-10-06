// Optional advisory screenshot checks. Playwright assertions remain independent.
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateDecisions, fail, hasControl, isObject, MODEL, readLocalFile, VisualQaError, INPUT_USD_PER_MILLION } from './decisions.mjs';

export const LIMITS = { screenshotBytes: 2 * 1024 * 1024, pixels: 4_000_000, dimension: 4096, manifestBytes: 16_384, checks: 8 };
export const PROVIDER = 'openai-decisions';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !hasControl(value, true);
const protectedPath = (file) =>
  file.split(/[\\/]/u).some((part) => /^(?:\.env(?:\..*)?|\.git|\.ssh|\.config|vault|credentials?(?:\..*)?|secrets?(?:\..*)?)$/iu.test(part));

export function imageMetadata(bytes, file) {
  const extension = path.extname(file).toLowerCase();
  let width, height, mime;
  if (extension === '.png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    let offset = 8;
    let dataSeen = false,
      endSeen = false;
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (offset + 12 + length > bytes.length) fail('invalid_image');
      if (offset === 8) {
        if (type !== 'IHDR' || length !== 13) fail('invalid_image');
        width = bytes.readUInt32BE(offset + 8);
        height = bytes.readUInt32BE(offset + 12);
      } else if (type === 'IHDR' || type === 'acTL') fail('invalid_image');
      if (type === 'IDAT') dataSeen = true;
      offset += 12 + length;
      if (type === 'IEND') {
        if (length !== 0 || offset !== bytes.length) fail('invalid_image');
        endSeen = true;
        break;
      }
    }
    if (!dataSeen || !endSeen) fail('invalid_image');
    mime = 'image/png';
  } else if (['.jpg', '.jpeg'].includes(extension) && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    let scanSeen = false;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) fail('invalid_image');
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (offset + 2 > bytes.length) fail('invalid_image');
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) fail('invalid_image');
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (length < 8 || width !== undefined) fail('invalid_image');
        height = bytes.readUInt16BE(offset + 3);
        width = bytes.readUInt16BE(offset + 5);
      }
      offset += length;
      if (marker === 0xda) {
        scanSeen = true;
        break;
      }
    }
    if (!scanSeen || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) fail('invalid_image');
    mime = 'image/jpeg';
  } else fail('unsupported_image');
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > LIMITS.dimension ||
    height > LIMITS.dimension ||
    width * height > LIMITS.pixels
  )
    fail('image_dimensions_limit');
  return { mime, width, height };
}

export function loadInput(inputFile) {
  if (typeof inputFile !== 'string' || !inputFile || protectedPath(inputFile)) fail('unsafe_manifest_path');
  const manifestPath = path.resolve(inputFile);
  const manifestBytes = readLocalFile(manifestPath, LIMITS.manifestBytes);
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch {
    fail('invalid_manifest');
  }
  if (!isObject(manifest) || manifest.version !== 1 || Object.keys(manifest).some((key) => !['version', 'screenshot', 'checks', 'context'].includes(key)))
    fail('invalid_manifest');
  const screenshot = manifest.screenshot;
  if (
    typeof screenshot !== 'string' ||
    screenshot.length > 512 ||
    !screenshot ||
    path.isAbsolute(screenshot) ||
    screenshot.includes('\\') ||
    hasControl(screenshot) ||
    screenshot.includes(':') ||
    screenshot.split('/').some((part) => !part || part === '.' || part === '..') ||
    protectedPath(screenshot)
  )
    fail('unsafe_screenshot_path');
  if (
    !Array.isArray(manifest.checks) ||
    manifest.checks.length < 1 ||
    manifest.checks.length > LIMITS.checks ||
    (manifest.context !== undefined && !text(manifest.context, 2000))
  )
    fail('invalid_manifest');
  const ids = new Set();
  for (const check of manifest.checks) {
    if (
      !isObject(check) ||
      Object.keys(check).some((key) => !['id', 'criterion'].includes(key)) ||
      typeof check.id !== 'string' ||
      !/^[a-z][a-z0-9_]{0,63}$/u.test(check.id) ||
      ids.has(check.id) ||
      !text(check.criterion, 1500)
    )
      fail('invalid_check');
    ids.add(check.id);
  }
  const screenshotPath = path.join(path.dirname(manifestPath), screenshot);
  const bytes = readLocalFile(screenshotPath, LIMITS.screenshotBytes);
  return {
    ...manifest,
    ...imageMetadata(bytes, screenshot),
    bytes,
    manifestPath,
    screenshotPath,
    manifestSha256: sha256(manifestBytes),
    screenshotSha256: sha256(bytes),
  };
}

function assertFresh(input) {
  if (
    sha256(readLocalFile(input.manifestPath, LIMITS.manifestBytes)) !== input.manifestSha256 ||
    sha256(readLocalFile(input.screenshotPath, LIMITS.screenshotBytes)) !== input.screenshotSha256
  )
    fail('input_changed');
}

export async function run({ input: inputFile, live = false, provider = PROVIDER } = {}, dependencies = {}) {
  const report = {
    version: 1,
    provider,
    model: MODEL,
    mode: live ? 'live' : 'offline',
    advisory: true,
    status: 'unavailable',
    networkCalls: 0,
    results: [],
    usage: {},
    estimatedInputCostUsd: null,
    costBasis: { inputUsdPerMillion: INPUT_USD_PER_MILLION, kind: 'estimate', imageTokensKnownBeforeRequest: false },
    threshold: { selectedProbability: 0.9, confidence: 0.9, calibrated: false },
  };
  try {
    if (provider !== PROVIDER) fail('unsupported_provider');
    const input = loadInput(inputFile);
    report.input = {
      screenshot: input.screenshot,
      screenshotSha256: input.screenshotSha256,
      manifestSha256: input.manifestSha256,
      mime: input.mime,
      bytes: input.bytes.length,
      width: input.width,
      height: input.height,
      checkIds: input.checks.map(({ id }) => id),
    };
    if (!live) return { report: { ...report, status: 'offline_validated' }, exitCode: 0 };
    const result = await evaluateDecisions(input, {
      ...dependencies,
      beforeRequest: () => {
        assertFresh(input);
        report.networkCalls = 1;
      },
    });
    Object.assign(report, result);
    assertFresh(input);
    report.status = report.results.every(({ status }) => status === 'satisfies') ? 'advisory_satisfies' : 'needs_review';
    return { report, exitCode: report.status === 'advisory_satisfies' ? 0 : 2 };
  } catch (error) {
    report.status = 'unavailable';
    report.results = [];
    report.reason = error instanceof VisualQaError ? error.code : 'evaluation_error';
    return { report, exitCode: 2 };
  }
}

export function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--live' && options.live === undefined) options.live = true;
    else if (['--input', '--provider'].includes(flag) && options[flag.slice(2)] === undefined && args[index + 1] && !args[index + 1].startsWith('--'))
      options[flag.slice(2)] = args[++index];
    else fail('invalid_arguments');
  }
  if (!options.input) fail('input_required');
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length === 3 && process.argv[2] === '--help') {
    console.log(
      'Usage: node scripts/visual-qa/check.mjs --input manifest.json [--live] [--provider openai-decisions]\nOffline by default. Live uploads the explicit screenshot for one advisory API request.',
    );
  } else {
    let outcome;
    try {
      outcome = await run(parseArgs(process.argv.slice(2)));
    } catch (error) {
      outcome = {
        report: { status: 'unavailable', advisory: true, reason: error instanceof VisualQaError ? error.code : 'invalid_arguments', networkCalls: 0 },
        exitCode: 2,
      };
    }
    console.log(JSON.stringify(outcome.report, null, 2));
    process.exitCode = outcome.exitCode;
  }
}
