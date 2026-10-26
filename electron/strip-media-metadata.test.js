/**
 * Unit tests for strip-media-metadata (Electron main process). The byte-level
 * fixtures mirror src/lib/media-metadata/__tests__/strip-media-metadata.test.ts
 * so the renderer and main-process implementations stay in lockstep.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareStrippedUploadFile, stripMediaMetadataBytes } from './strip-media-metadata.js';

function ascii(text) {
  return Array.from(text, (char) => char.charCodeAt(0));
}

function u32be(value) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function u32le(value) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function strip(bytes) {
  const result = stripMediaMetadataBytes(new Uint8Array(bytes));
  return result === null ? null : Array.from(result);
}

// --- JPEG fixtures ---

function jpegSegment(marker, payload) {
  const length = payload.length + 2;
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

const SOI = [0xff, 0xd8];
const app0Jfif = jpegSegment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const app1Exif = jpegSegment(0xe1, [...ascii('Exif'), 0, 0, ...ascii('II*'), 0, ...ascii('GPSLATITUDE 51.5072')]);
const app1Xmp = jpegSegment(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/'), 0, ...ascii('<x:xmpmeta/>')]);
const app13Iptc = jpegSegment(0xed, [...ascii('Photoshop 3.0'), 0, ...ascii('8BIM')]);
const app2Icc = jpegSegment(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1, 9, 9, 9]);
const com = jpegSegment(0xfe, ascii('shot on my phone'));
const dqt = jpegSegment(0xdb, [0, ...Array.from({ length: 64 }, () => 7)]);
const sof0 = jpegSegment(0xc0, [8, 0, 1, 0, 1, 1, 0x11, 0x11, 0]);
const dht = jpegSegment(0xc4, [0, ...Array.from({ length: 16 }, () => 0), 0x0a]);
// SOS header, entropy-coded data with 0xff00 stuffing, EOI, deliberately appended payload
const sosToEof = [0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0, 0x12, 0xff, 0x00, 0x34, 0xab, 0xff, 0xd9, ...ascii('APPENDED_PAYLOAD')];

const jpegWithMetadata = [...SOI, ...app0Jfif, ...app1Exif, ...app1Xmp, ...app13Iptc, ...app2Icc, ...com, ...dqt, ...sof0, ...dht, ...sosToEof];
const jpegStripped = [...SOI, ...app0Jfif, ...app2Icc, ...dqt, ...sof0, ...dht, ...sosToEof];

/** Valid Exif APP1 whose IFD0 holds a Make entry (exercises the walk) and an Orientation entry. */
function exifApp1WithOrientation(orientation, littleEndian = true) {
  const tiff = littleEndian
    ? [
        0x49,
        0x49,
        0x2a,
        0x00,
        ...u32le(8), // "II", 42, IFD0 at offset 8
        0x02,
        0x00, // two entries
        0x0f,
        0x01,
        0x02,
        0x00,
        ...u32le(4),
        ...ascii('abc'),
        0x00, // Make, ASCII x4 inline
        0x12,
        0x01,
        0x03,
        0x00,
        ...u32le(1),
        orientation,
        0x00,
        0x00,
        0x00, // Orientation, SHORT x1
        ...u32le(0), // no next IFD
      ]
    : [
        0x4d,
        0x4d,
        0x00,
        0x2a,
        ...u32be(8), // "MM", 42, IFD0 at offset 8
        0x00,
        0x02,
        0x01,
        0x0f,
        0x00,
        0x02,
        ...u32be(4),
        ...ascii('abc'),
        0x00,
        0x01,
        0x12,
        0x00,
        0x03,
        ...u32be(1),
        0x00,
        orientation,
        0x00,
        0x00,
        ...u32be(0),
      ];
  return jpegSegment(0xe1, [...ascii('Exif'), 0, 0, ...tiff]);
}

/** The minimal APP1 the stripper is expected to synthesize (always little-endian). */
function orientationApp1(orientation) {
  return [
    0xff,
    0xe1,
    0x00,
    0x22,
    ...ascii('Exif'),
    0,
    0,
    0x49,
    0x49,
    0x2a,
    0x00,
    ...u32le(8),
    0x01,
    0x00,
    0x12,
    0x01,
    0x03,
    0x00,
    ...u32le(1),
    orientation,
    0x00,
    0x00,
    0x00,
    ...u32le(0),
  ];
}

// --- PNG fixtures ---

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = ascii(type);
  return [...u32be(data.length), ...typeBytes, ...data, ...u32be(crc32([...typeBytes, ...data]))];
}

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ihdr = pngChunk('IHDR', [...u32be(1), ...u32be(1), 8, 6, 0, 0, 0]);
const text = pngChunk('tEXt', [...ascii('Comment'), 0, ...ascii('gps: 51.5, -0.1')]);
const ztxt = pngChunk('zTXt', [...ascii('Author'), 0, 0, 1, 2, 3]);
const itxt = pngChunk('iTXt', [...ascii('XML:com.adobe.xmp'), 0, 0, 0, 0, 0, ...ascii('<xmp/>')]);
const exifChunk = pngChunk('eXIf', [...ascii('II*'), 0, 1, 2, 3]);
const time = pngChunk('tIME', [7, 0xe8, 1, 1, 0, 0, 0]);
const unknownAncillary = pngChunk('prVt', ascii('secret'));
const phys = pngChunk('pHYs', [...u32be(2835), ...u32be(2835), 1]);
const idat = pngChunk('IDAT', [0x78, 0x9c, 1, 2, 3, 4]);
const iend = pngChunk('IEND', []);
const pngTrailer = ascii('TRAILING_DATA');

const pngWithMetadata = [...pngSignature, ...ihdr, ...text, ...ztxt, ...itxt, ...exifChunk, ...time, ...unknownAncillary, ...phys, ...idat, ...iend, ...pngTrailer];
const pngStripped = [...pngSignature, ...ihdr, ...phys, ...idat, ...iend, ...pngTrailer];

// --- WebP fixtures ---

function webpChunk(fourCc, data) {
  const padded = data.length % 2 === 1 ? [...data, 0] : data;
  return [...ascii(fourCc), ...u32le(data.length), ...padded];
}

function riffWebp(chunks) {
  const payload = chunks.flat();
  return [...ascii('RIFF'), ...u32le(4 + payload.length), ...ascii('WEBP'), ...payload];
}

// flags: ALPHA (0x10) | EXIF (0x08) | XMP (0x04)
const vp8x = webpChunk('VP8X', [0x1c, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const vp8xCleared = webpChunk('VP8X', [0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const iccp = webpChunk('ICCP', [1, 2, 3, 4, 5]); // odd size exercises padding
const webpExif = webpChunk('EXIF', [...ascii('II*'), 0, 0x99]); // odd size exercises padding
const webpXmp = webpChunk('XMP ', ascii('<x:xmpmeta/>'));
const vp8 = webpChunk('VP8 ', [0x30, 1, 0, 0x9d, 0x01, 0x2a, 1, 0, 1, 0]);

const webpWithMetadata = riffWebp([vp8x, iccp, webpExif, webpXmp, vp8]);
const webpStripped = riffWebp([vp8xCleared, iccp, vp8]);

describe('stripMediaMetadataBytes', () => {
  describe('jpeg', () => {
    it('removes APP1 (Exif and XMP), APP13, and COM while keeping APP0, APP2, and coding segments', () => {
      expect(strip(jpegWithMetadata)).toEqual(jpegStripped);
    });

    it('copies SOS-onward bytes verbatim, including data appended after EOI', () => {
      const output = strip(jpegWithMetadata);

      expect(output.slice(output.length - sosToEof.length)).toEqual(sosToEof);
      const appended = ascii('APPENDED_PAYLOAD');
      expect(output.slice(output.length - appended.length)).toEqual(appended);
    });

    it('returns null when there is no metadata to remove', () => {
      expect(strip([...SOI, ...app0Jfif, ...dqt, ...sof0, ...dht, ...sosToEof])).toBeNull();
    });

    it('returns null when a segment length overruns the file', () => {
      expect(strip([...SOI, 0xff, 0xe1, 0xff, 0xff, 1, 2, 3])).toBeNull();
    });

    it('returns null when SOS is never reached', () => {
      expect(strip([...SOI, ...app1Exif, ...dqt])).toBeNull();
    });

    it('returns null when marker structure is invalid', () => {
      expect(strip([...SOI, 0x00, 0x01, 0x02, 0x03])).toBeNull();
    });

    it('re-emits the Exif Orientation tag as a minimal APP1 so photos keep their rotation', () => {
      expect(strip([...SOI, ...app0Jfif, ...exifApp1WithOrientation(6), ...com, ...dqt, ...sof0, ...dht, ...sosToEof])).toEqual([
        ...SOI,
        ...orientationApp1(6),
        ...app0Jfif,
        ...dqt,
        ...sof0,
        ...dht,
        ...sosToEof,
      ]);
    });

    it('reads big-endian Exif and re-emits the orientation little-endian', () => {
      expect(strip([...SOI, ...exifApp1WithOrientation(3, false), ...dqt, ...sof0, ...dht, ...sosToEof])).toEqual([
        ...SOI,
        ...orientationApp1(3),
        ...dqt,
        ...sof0,
        ...dht,
        ...sosToEof,
      ]);
    });

    it('does not re-emit the default orientation 1', () => {
      expect(strip([...SOI, ...exifApp1WithOrientation(1), ...dqt, ...sof0, ...dht, ...sosToEof])).toEqual([...SOI, ...dqt, ...sof0, ...dht, ...sosToEof]);
    });

    it('does not re-emit an out-of-range orientation value', () => {
      expect(strip([...SOI, ...exifApp1WithOrientation(9), ...dqt, ...sof0, ...dht, ...sosToEof])).toEqual([...SOI, ...dqt, ...sof0, ...dht, ...sosToEof]);
    });
  });

  describe('png', () => {
    it('removes tEXt, zTXt, iTXt, eXIf, tIME, and unknown ancillary chunks while keeping listed chunks', () => {
      expect(strip(pngWithMetadata)).toEqual(pngStripped);
    });

    it('keeps critical chunks and data appended after IEND', () => {
      const output = strip(pngWithMetadata);

      expect(output.slice(0, 8)).toEqual(pngSignature);
      for (const chunk of [ihdr, idat, iend]) {
        expect(indexOfSequence(output, chunk)).toBeGreaterThanOrEqual(0);
      }
      expect(output.slice(output.length - pngTrailer.length)).toEqual(pngTrailer);
    });

    it('returns null when there is no metadata to remove', () => {
      expect(strip([...pngSignature, ...ihdr, ...idat, ...iend])).toBeNull();
    });

    it('returns null when a chunk length overruns the file', () => {
      expect(strip([...pngSignature, ...u32be(9999), ...ascii('tEXt'), 1, 2, 3])).toBeNull();
    });

    it('returns null when IEND is missing', () => {
      expect(strip([...pngSignature, ...ihdr, ...text, ...idat])).toBeNull();
    });
  });

  describe('webp', () => {
    it('removes EXIF and XMP chunks, clears VP8X metadata flags, and fixes the RIFF size', () => {
      expect(strip(webpWithMetadata)).toEqual(webpStripped);
    });

    it('clears VP8X metadata flags even when no EXIF or XMP chunk is present', () => {
      expect(strip(riffWebp([vp8x, vp8]))).toEqual(riffWebp([vp8xCleared, vp8]));
    });

    it('returns null when there is no metadata to remove', () => {
      expect(strip(riffWebp([vp8]))).toBeNull();
    });

    it('returns null when the RIFF size overruns the file', () => {
      expect(strip([...ascii('RIFF'), ...u32le(9999), ...ascii('WEBP'), ...vp8])).toBeNull();
    });

    it('returns null when a chunk overruns the RIFF payload', () => {
      expect(strip(riffWebp([webpChunk('EXIF', [1, 2]).slice(0, 8)]))).toBeNull();
    });
  });

  describe('pass-through formats', () => {
    it('returns null for GIF files, including comment extensions', () => {
      expect(strip([...ascii('GIF89a'), 1, 0, 1, 0, 0x91, 0, 0, 0x21, 0xfe, 4, ...ascii('gps!'), 0, 0x3b])).toBeNull();
    });

    it('returns null for mp4 files', () => {
      expect(strip([...u32be(0x18), ...ascii('ftypmp42'), ...Array.from({ length: 16 }, () => 0)])).toBeNull();
    });

    it('returns null for webm files', () => {
      expect(strip([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4])).toBeNull();
    });

    it('returns null for unknown formats', () => {
      expect(strip(ascii('not an image at all'))).toBeNull();
    });

    it('returns null for empty input', () => {
      expect(strip([])).toBeNull();
    });
  });
});

describe('prepareStrippedUploadFile', () => {
  const cleanupDirs = [];

  const makeTestDir = async () => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), '5chan-strip-test-'));
    cleanupDirs.push(dir);
    return dir;
  };

  const writeTestFile = async (name, bytes) => {
    const filePath = path.join(await makeTestDir(), name);
    await fs.promises.writeFile(filePath, new Uint8Array(bytes));
    return filePath;
  };

  afterEach(async () => {
    while (cleanupDirs.length > 0) {
      await fs.promises.rm(cleanupDirs.pop(), { force: true, recursive: true });
    }
  });

  it('writes a stripped copy with the same basename to a temp dir and leaves the original untouched', async () => {
    const filePath = await writeTestFile('photo.jpg', jpegWithMetadata);

    const prepared = await prepareStrippedUploadFile(filePath);
    if (prepared.tempDir) cleanupDirs.push(prepared.tempDir);

    expect(prepared.tempDir).not.toBeNull();
    expect(prepared.filePath).not.toBe(filePath);
    expect(path.basename(prepared.filePath)).toBe('photo.jpg');
    expect(Array.from(await fs.promises.readFile(prepared.filePath))).toEqual(jpegStripped);
    expect(Array.from(await fs.promises.readFile(filePath))).toEqual(jpegWithMetadata);
  });

  it('returns the original path when there is no metadata to remove', async () => {
    const filePath = await writeTestFile('clean.jpg', [...SOI, ...app0Jfif, ...dqt, ...sof0, ...dht, ...sosToEof]);

    expect(await prepareStrippedUploadFile(filePath)).toEqual({ filePath, tempDir: null });
  });

  it('returns the original path for pass-through formats', async () => {
    const filePath = await writeTestFile('anim.gif', [...ascii('GIF89a'), 1, 0, 1, 0, 0x91, 0, 0, 0x3b]);

    expect(await prepareStrippedUploadFile(filePath)).toEqual({ filePath, tempDir: null });
  });

  it('returns the original path for files over the size cap without reading them', async () => {
    const filePath = path.join(await makeTestDir(), 'huge.jpg');
    const handle = await fs.promises.open(filePath, 'w');
    await handle.truncate(64 * 1024 * 1024 + 1); // sparse file: instant to create, slow to read
    await handle.close();

    expect(await prepareStrippedUploadFile(filePath)).toEqual({ filePath, tempDir: null });
  });

  it('returns the original path when the file cannot be read', async () => {
    const filePath = path.join(await makeTestDir(), 'missing.jpg');

    expect(await prepareStrippedUploadFile(filePath)).toEqual({ filePath, tempDir: null });
  });
});

function indexOfSequence(haystack, needle) {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
