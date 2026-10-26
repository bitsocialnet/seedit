/**
 * Main-process media metadata stripping for the disk-path upload automation
 * route, where the renderer only hands over a file path and the bytes never
 * transit JS (parity with src/lib/media-metadata/strip-media-metadata.ts —
 * keep the two byte-level implementations in sync). Removes privacy-sensitive
 * metadata (EXIF/GPS, XMP, IPTC, comments) from JPEG/PNG/WebP before any
 * upload provider sees the bytes. Containers are rewritten losslessly; pixel
 * data is never re-encoded, so the Exif Orientation tag (rotation lives in
 * metadata, not pixels) is re-emitted, as a minimal JPEG APP1 or WebP EXIF
 * chunk, to keep photos from rendering sideways. GIF, video, and unknown formats pass through
 * untouched, and on any anomaly the original file is used unchanged so an
 * upload is never blocked.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

/** Files larger than this pass through untouched to avoid large in-memory copies. */
const MAX_PROCESSABLE_BYTES = 64 * 1024 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** JPEG segments removed: APP1 (Exif and XMP), APP13 (IPTC/Photoshop), COM. */
const JPEG_DROPPED_MARKERS = new Set([0xe1, 0xed, 0xfe]);

/** "Exif\0\0" — the payload prefix distinguishing an Exif APP1 from XMP. */
const EXIF_APP1_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];

/**
 * PNG ancillary chunks kept because they affect rendering (plus APNG frames).
 * Critical chunks are always kept; ancillary chunks not listed here (tEXt,
 * zTXt, iTXt, eXIf, tIME, and unknown ones) are dropped.
 */
const PNG_KEPT_ANCILLARY_CHUNKS = new Set(['tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'bKGD', 'pHYs', 'acTL', 'fcTL', 'fdAT']);

/** VP8X header flag bits announcing EXIF (0x08) and XMP (0x04) chunks. */
const WEBP_VP8X_METADATA_FLAGS = 0x0c;
const WEBP_VP8X_EXIF_FLAG = 0x08;

/**
 * Prepares the file for upload automation: when it is a JPEG/PNG/WebP with
 * removable metadata, writes a stripped copy (same basename, so the uploaded
 * filename is unchanged) into a fresh temp dir and returns that path plus the
 * temp dir the caller must remove afterwards. Returns the original path with a
 * null tempDir when there is nothing to strip, the format is not handled, the
 * file is too large, or anything fails — uploads never break, and the user's
 * original file is never modified.
 * @param {string} filePath - Absolute path to the file to upload
 * @returns {Promise<{ filePath: string; tempDir: string | null }>}
 */
export async function prepareStrippedUploadFile(filePath) {
  let tempDir = null;
  try {
    const { size } = await fs.promises.stat(filePath);
    if (size > MAX_PROCESSABLE_BYTES) return { filePath, tempDir: null };
    const stripped = stripMediaMetadataBytes(await fs.promises.readFile(filePath));
    if (stripped === null) return { filePath, tempDir: null };
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'seedit-strip-'));
    const strippedPath = path.join(tempDir, path.basename(filePath));
    await fs.promises.writeFile(strippedPath, stripped);
    return { filePath: strippedPath, tempDir };
  } catch {
    if (tempDir) await fs.promises.rm(tempDir, { force: true, recursive: true }).catch(() => {});
    return { filePath, tempDir: null };
  }
}

/**
 * Detects the format by magic bytes (mime/extension are never trusted) and
 * returns a stripped copy, or null meaning "keep original". Exported for tests.
 * @param {Uint8Array} bytes
 * @returns {Uint8Array | null}
 */
export function stripMediaMetadataBytes(bytes) {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return stripJpeg(bytes);
  }
  if (bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) {
    return stripPng(bytes);
  }
  if (bytes.length >= 16 && readFourCc(bytes, 0) === 'RIFF' && readFourCc(bytes, 8) === 'WEBP') {
    return stripWebp(bytes);
  }
  // GIF passes through deliberately (rewriting animations is risky and GIFs
  // carry no GPS-class metadata); video and unknown formats pass through too.
  return null;
}

function stripJpeg(bytes) {
  const len = bytes.length;
  const kept = [bytes.subarray(0, 2)];
  let removedBytes = 0;
  let orientation = 0;
  let pos = 2;

  for (;;) {
    if (pos + 1 >= len || bytes[pos] !== 0xff) return null;
    // A marker may be preceded by any number of 0xff fill bytes.
    let markerPos = pos + 1;
    while (markerPos < len && bytes[markerPos] === 0xff) markerPos++;
    if (markerPos >= len) return null;
    const marker = bytes[markerPos];

    if (marker === 0xda) {
      // SOS: entropy-coded data follows and contains 0xff bytes that are not
      // segment markers, so copy verbatim to EOF instead of parsing. This
      // also preserves data deliberately appended after EOI. Marker segments
      // after the first SOS are deliberately left untouched: cameras write
      // metadata before the first scan, and parsing entropy-coded data risks
      // degrading exotic-but-valid files (e.g. motion-photo trailers) into
      // full pass-through, which would strip less than this does.
      kept.push(bytes.subarray(pos, len));
      break;
    }
    // Standalone markers (TEM, RST, SOI, EOI) are not expected before SOS.
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) return null;

    if (markerPos + 2 >= len) return null;
    const segmentLength = (bytes[markerPos + 1] << 8) | bytes[markerPos + 2];
    if (segmentLength < 2) return null;
    const end = markerPos + 1 + segmentLength;
    if (end > len) return null;

    if (JPEG_DROPPED_MARKERS.has(marker)) {
      if (marker === 0xe1 && orientation === 0 && isExifApp1Payload(bytes, markerPos + 3, end)) {
        orientation = readExifOrientation(bytes, markerPos + 9, end);
      }
      removedBytes += end - pos;
    } else {
      kept.push(bytes.subarray(pos, end));
    }
    pos = end;
  }

  if (removedBytes === 0) return null;
  // Rotation lives in metadata, not pixels: re-emit the Orientation tag (and
  // nothing else) as a minimal APP1 after SOI so photos don't render sideways.
  if (orientation >= 2 && orientation <= 8) {
    kept.splice(1, 0, buildOrientationApp1(orientation));
  }
  return concat(kept);
}

function isExifApp1Payload(bytes, start, end) {
  return start + EXIF_APP1_HEADER.length <= end && EXIF_APP1_HEADER.every((b, i) => bytes[start + i] === b);
}

/** Reads the Orientation tag (1-8) from IFD0 of an Exif TIFF block, or 0 when absent or malformed. */
function readExifOrientation(bytes, tiffStart, end) {
  if (tiffStart + 8 > end) return 0;
  let little;
  if (bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49) little = true;
  else if (bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d) little = false;
  else return 0;
  const readU16 = (pos) => (little ? bytes[pos] | (bytes[pos + 1] << 8) : (bytes[pos] << 8) | bytes[pos + 1]);
  const readU32 = (pos) => (little ? readU32le(bytes, pos) : readU32be(bytes, pos));
  if (readU16(tiffStart + 2) !== 42) return 0;
  const ifdOffset = readU32(tiffStart + 4);
  if (ifdOffset < 8) return 0;
  const ifdPos = tiffStart + ifdOffset;
  if (ifdPos + 2 > end) return 0;
  const entryCount = readU16(ifdPos);
  for (let i = 0; i < entryCount; i++) {
    const entry = ifdPos + 2 + i * 12;
    if (entry + 12 > end) return 0;
    if (readU16(entry) !== 0x0112) continue;
    // Orientation must be a single SHORT; the value sits in the first two payload bytes.
    if (readU16(entry + 2) !== 3 || readU32(entry + 4) !== 1) return 0;
    const value = readU16(entry + 8);
    return value >= 1 && value <= 8 ? value : 0;
  }
  return 0;
}

/** Minimal little-endian Exif TIFF block (26 bytes) whose IFD0 holds only the Orientation tag. */
function buildOrientationTiff(orientation) {
  // prettier-ignore
  return [
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // "II", 42, IFD0 at offset 8
    0x01, 0x00, // one IFD entry
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00, // Orientation, SHORT x1
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ];
}

/** Minimal Exif APP1 whose IFD0 holds only the Orientation tag. */
function buildOrientationApp1(orientation) {
  return new Uint8Array([0xff, 0xe1, 0x00, 0x22, ...EXIF_APP1_HEADER, ...buildOrientationTiff(orientation)]); // APP1, length 34
}

/** Minimal WebP EXIF chunk whose IFD0 holds only the Orientation tag; its even size needs no padding. */
function buildOrientationWebpChunk(orientation) {
  return new Uint8Array([0x45, 0x58, 0x49, 0x46, 0x1a, 0x00, 0x00, 0x00, ...buildOrientationTiff(orientation)]); // "EXIF", size 26
}

/** Orientation from a WebP EXIF payload: a TIFF block, which some writers prefix with JPEG's "Exif\0\0". */
function readWebpExifOrientation(bytes, start, end) {
  return readExifOrientation(bytes, isExifApp1Payload(bytes, start, end) ? start + EXIF_APP1_HEADER.length : start, end);
}

function stripPng(bytes) {
  const len = bytes.length;
  const kept = [bytes.subarray(0, 8)];
  let removedBytes = 0;
  let pos = 8;

  for (;;) {
    if (pos + 8 > len) return null; // ran out of bytes before IEND
    const dataLength = readU32be(bytes, pos);
    if (dataLength > 0x7fffffff) return null;
    const end = pos + 12 + dataLength; // length + type + data + CRC
    if (end > len) return null;
    const type = readFourCc(bytes, pos + 4);

    if (type === 'IEND') {
      // Keep IEND and any deliberately appended trailing data verbatim.
      kept.push(bytes.subarray(pos, len));
      break;
    }

    const isCritical = (bytes[pos + 4] & 0x20) === 0;
    if (isCritical || PNG_KEPT_ANCILLARY_CHUNKS.has(type)) {
      // Chunks are copied whole so their CRCs remain valid.
      kept.push(bytes.subarray(pos, end));
    } else {
      removedBytes += end - pos;
    }
    pos = end;
  }

  if (removedBytes === 0) return null;
  return concat(kept);
}

function stripWebp(bytes) {
  const len = bytes.length;
  const riffEnd = 8 + readU32le(bytes, 4);
  if (riffEnd < 12 || riffEnd > len) return null;

  const kept = [bytes.subarray(0, 12)];
  let outLength = 12;
  let removedBytes = 0;
  let vp8xFlagsOffset = -1;
  let vp8xHasMetadataFlags = false;
  let keptOrientation = false;
  let pos = 12;

  while (pos < riffEnd) {
    if (pos + 8 > riffEnd) return null;
    const fourCc = readFourCc(bytes, pos);
    const chunkSize = readU32le(bytes, pos + 4);
    const end = pos + 8 + chunkSize + (chunkSize & 1); // chunks are padded to even sizes
    if (end > riffEnd) return null;

    if (fourCc === 'EXIF' || fourCc === 'XMP ') {
      removedBytes += end - pos;
      // Rotation lives in metadata, not pixels: put the Orientation tag (and nothing else) back in the
      // EXIF chunk's place. Only the extended format, which starts with VP8X, can carry EXIF.
      const orientation = fourCc === 'EXIF' && vp8xFlagsOffset >= 0 && !keptOrientation ? readWebpExifOrientation(bytes, pos + 8, pos + 8 + chunkSize) : 0;
      if (orientation >= 2 && orientation <= 8) {
        const chunk = buildOrientationWebpChunk(orientation);
        kept.push(chunk);
        outLength += chunk.length;
        keptOrientation = true;
      }
    } else {
      if (fourCc === 'VP8X') {
        if (chunkSize < 10) return null;
        vp8xFlagsOffset = outLength + 8;
        vp8xHasMetadataFlags = (bytes[pos + 8] & WEBP_VP8X_METADATA_FLAGS) !== 0;
      }
      kept.push(bytes.subarray(pos, end));
      outLength += end - pos;
    }
    pos = end;
  }

  if (removedBytes === 0 && !vp8xHasMetadataFlags) return null;

  if (riffEnd < len) kept.push(bytes.subarray(riffEnd, len)); // keep appended trailing data
  const out = concat(kept);
  writeU32le(out, 4, outLength - 8);
  if (vp8xFlagsOffset >= 0) out[vp8xFlagsOffset] = (out[vp8xFlagsOffset] & ~WEBP_VP8X_METADATA_FLAGS) | (keptOrientation ? WEBP_VP8X_EXIF_FLAG : 0);
  return out;
}

function concat(parts) {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function readFourCc(bytes, pos) {
  return String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
}

function readU32be(bytes, pos) {
  return ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0;
}

function readU32le(bytes, pos) {
  return (bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24)) >>> 0;
}

function writeU32le(bytes, pos, value) {
  bytes[pos] = value & 0xff;
  bytes[pos + 1] = (value >>> 8) & 0xff;
  bytes[pos + 2] = (value >>> 16) & 0xff;
  bytes[pos + 3] = (value >>> 24) & 0xff;
}
