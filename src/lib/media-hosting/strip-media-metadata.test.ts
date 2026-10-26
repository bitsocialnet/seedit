// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { stripMediaMetadata } from './strip-media-metadata';

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

function u32be(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function u32le(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function makeFile(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type, lastModified: 1700000000000 });
}

async function bytesOf(file: File): Promise<number[]> {
  return Array.from(new Uint8Array(await file.arrayBuffer()));
}

// --- JPEG fixtures ---

function jpegSegment(marker: number, payload: number[]): number[] {
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
function exifApp1WithOrientation(orientation: number, littleEndian = true): number[] {
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
function orientationApp1(orientation: number): number[] {
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

function crc32(bytes: number[]): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: number[]): number[] {
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

function webpChunk(fourCc: string, data: number[]): number[] {
  const padded = data.length % 2 === 1 ? [...data, 0] : data;
  return [...ascii(fourCc), ...u32le(data.length), ...padded];
}

function riffWebp(chunks: number[][]): number[] {
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

// flags: ALPHA (0x10) | EXIF (0x08), for a stripped file that keeps its orientation
const vp8xExifOnly = webpChunk('VP8X', [0x18, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
// A WebP EXIF payload is a bare TIFF block: the APP1 fixtures minus marker, length and "Exif\0\0".
const exifTiffWithOrientation = (orientation: number, littleEndian = true) => exifApp1WithOrientation(orientation, littleEndian).slice(10);
const orientationWebpExif = (orientation: number) => webpChunk('EXIF', orientationApp1(orientation).slice(10));

describe('stripMediaMetadata', () => {
  describe('jpeg', () => {
    it('removes APP1 (Exif and XMP), APP13, and COM while keeping APP0, APP2, and coding segments', async () => {
      const file = makeFile(jpegWithMetadata, 'photo.jpg', 'image/jpeg');
      const result = await stripMediaMetadata(file);

      expect(result).not.toBe(file);
      expect(await bytesOf(result)).toEqual(jpegStripped);
    });

    it('copies SOS-onward bytes verbatim, including data appended after EOI', async () => {
      const file = makeFile(jpegWithMetadata, 'photo.jpg', 'image/jpeg');
      const result = await stripMediaMetadata(file);
      const output = await bytesOf(result);

      expect(output.slice(output.length - sosToEof.length)).toEqual(sosToEof);
      const appended = ascii('APPENDED_PAYLOAD');
      expect(output.slice(output.length - appended.length)).toEqual(appended);
    });

    it('preserves name, type, and lastModified', async () => {
      const file = makeFile(jpegWithMetadata, 'photo.jpg', 'image/jpeg');
      const result = await stripMediaMetadata(file);

      expect(result.name).toBe('photo.jpg');
      expect(result.type).toBe('image/jpeg');
      expect(result.lastModified).toBe(file.lastModified);
    });

    it('returns the original file object when there is no metadata to remove', async () => {
      const file = makeFile([...SOI, ...app0Jfif, ...dqt, ...sof0, ...dht, ...sosToEof], 'clean.jpg', 'image/jpeg');

      expect(await stripMediaMetadata(file)).toBe(file);
    });

    it('returns the original file when a segment length overruns the file', async () => {
      const file = makeFile([...SOI, 0xff, 0xe1, 0xff, 0xff, 1, 2, 3], 'corrupt.jpg', 'image/jpeg');

      expect(await stripMediaMetadata(file)).toBe(file);
    });

    it('returns the original file when SOS is never reached', async () => {
      const file = makeFile([...SOI, ...app1Exif, ...dqt], 'truncated.jpg', 'image/jpeg');

      expect(await stripMediaMetadata(file)).toBe(file);
    });

    it('returns the original file when marker structure is invalid', async () => {
      const file = makeFile([...SOI, 0x00, 0x01, 0x02, 0x03], 'garbage.jpg', 'image/jpeg');

      expect(await stripMediaMetadata(file)).toBe(file);
    });

    it('re-emits the Exif Orientation tag as a minimal APP1 so photos keep their rotation', async () => {
      const file = makeFile([...SOI, ...app0Jfif, ...exifApp1WithOrientation(6), ...com, ...dqt, ...sof0, ...dht, ...sosToEof], 'portrait.jpg', 'image/jpeg');

      expect(await bytesOf(await stripMediaMetadata(file))).toEqual([...SOI, ...orientationApp1(6), ...app0Jfif, ...dqt, ...sof0, ...dht, ...sosToEof]);
    });

    it('reads big-endian Exif and re-emits the orientation little-endian', async () => {
      const file = makeFile([...SOI, ...exifApp1WithOrientation(3, false), ...dqt, ...sof0, ...dht, ...sosToEof], 'be.jpg', 'image/jpeg');

      expect(await bytesOf(await stripMediaMetadata(file))).toEqual([...SOI, ...orientationApp1(3), ...dqt, ...sof0, ...dht, ...sosToEof]);
    });

    it('does not re-emit the default orientation 1', async () => {
      const file = makeFile([...SOI, ...exifApp1WithOrientation(1), ...dqt, ...sof0, ...dht, ...sosToEof], 'upright.jpg', 'image/jpeg');

      expect(await bytesOf(await stripMediaMetadata(file))).toEqual([...SOI, ...dqt, ...sof0, ...dht, ...sosToEof]);
    });

    it('does not re-emit an out-of-range orientation value', async () => {
      const file = makeFile([...SOI, ...exifApp1WithOrientation(9), ...dqt, ...sof0, ...dht, ...sosToEof], 'invalid.jpg', 'image/jpeg');

      expect(await bytesOf(await stripMediaMetadata(file))).toEqual([...SOI, ...dqt, ...sof0, ...dht, ...sosToEof]);
    });
  });

  describe('png', () => {
    it('removes tEXt, zTXt, iTXt, eXIf, tIME, and unknown ancillary chunks while keeping listed chunks', async () => {
      const file = makeFile(pngWithMetadata, 'image.png', 'image/png');
      const result = await stripMediaMetadata(file);

      expect(result).not.toBe(file);
      expect(await bytesOf(result)).toEqual(pngStripped);
    });

    it('keeps critical chunks and data appended after IEND', async () => {
      const file = makeFile(pngWithMetadata, 'image.png', 'image/png');
      const output = await bytesOf(await stripMediaMetadata(file));

      expect(output.slice(0, 8)).toEqual(pngSignature);
      for (const chunk of [ihdr, idat, iend]) {
        expect(indexOfSequence(output, chunk)).toBeGreaterThanOrEqual(0);
      }
      expect(output.slice(output.length - pngTrailer.length)).toEqual(pngTrailer);
    });

    it('returns the original file object when there is no metadata to remove', async () => {
      const file = makeFile([...pngSignature, ...ihdr, ...idat, ...iend], 'clean.png', 'image/png');

      expect(await stripMediaMetadata(file)).toBe(file);
    });

    it('returns the original file when a chunk length overruns the file', async () => {
      const file = makeFile([...pngSignature, ...u32be(9999), ...ascii('tEXt'), 1, 2, 3], 'corrupt.png', 'image/png');

      expect(await stripMediaMetadata(file)).toBe(file);
    });

    it('returns the original file when IEND is missing', async () => {
      const file = makeFile([...pngSignature, ...ihdr, ...text, ...idat], 'no-iend.png', 'image/png');

      expect(await stripMediaMetadata(file)).toBe(file);
    });
  });

  describe('webp', () => {
    it('removes EXIF and XMP chunks, clears VP8X metadata flags, and fixes the RIFF size', async () => {
      const file = makeFile(webpWithMetadata, 'image.webp', 'image/webp');
      const result = await stripMediaMetadata(file);

      expect(result).not.toBe(file);
      expect(await bytesOf(result)).toEqual(webpStripped);
    });

    it('keeps only the Exif Orientation tag, as a minimal EXIF chunk, so images keep their rotation', async () => {
      const file = makeFile(riffWebp([vp8x, iccp, vp8, webpChunk('EXIF', exifTiffWithOrientation(6)), webpXmp]), 'portrait.webp', 'image/webp');

      expect(await bytesOf(await stripMediaMetadata(file))).toEqual(riffWebp([vp8xExifOnly, iccp, vp8, orientationWebpExif(6)]));
    });

    it('reads the orientation from big-endian EXIF that carries the JPEG Exif header', async () => {
      const file = makeFile(riffWebp([vp8x, vp8, webpChunk('EXIF', [...ascii('Exif'), 0, 0, ...exifTiffWithOrientation(8, false)])]), 'prefixed.webp', 'image/webp');

      expect(await bytesOf(await stripMediaMetadata(file))).toEqual(riffWebp([vp8xExifOnly, vp8, orientationWebpExif(8)]));
    });

    it('does not re-emit the default orientation 1', async () => {
      const file = makeFile(riffWebp([vp8x, vp8, webpChunk('EXIF', exifTiffWithOrientation(1))]), 'upright.webp', 'image/webp');

      expect(await bytesOf(await stripMediaMetadata(file))).toEqual(riffWebp([vp8xCleared, vp8]));
    });

    it('clears VP8X metadata flags even when no EXIF or XMP chunk is present', async () => {
      const file = makeFile(riffWebp([vp8x, vp8]), 'flags-only.webp', 'image/webp');

      expect(await bytesOf(await stripMediaMetadata(file))).toEqual(riffWebp([vp8xCleared, vp8]));
    });

    it('returns the original file object when there is no metadata to remove', async () => {
      const file = makeFile(riffWebp([vp8]), 'clean.webp', 'image/webp');

      expect(await stripMediaMetadata(file)).toBe(file);
    });

    it('returns the original file when the RIFF size overruns the file', async () => {
      const file = makeFile([...ascii('RIFF'), ...u32le(9999), ...ascii('WEBP'), ...vp8], 'corrupt.webp', 'image/webp');

      expect(await stripMediaMetadata(file)).toBe(file);
    });

    it('returns the original file when a chunk overruns the RIFF payload', async () => {
      const file = makeFile(riffWebp([webpChunk('EXIF', [1, 2]).slice(0, 8)]), 'truncated.webp', 'image/webp');

      expect(await stripMediaMetadata(file)).toBe(file);
    });
  });

  describe('pass-through formats', () => {
    it('returns GIF files unchanged, including comment extensions', async () => {
      const gif = [...ascii('GIF89a'), 1, 0, 1, 0, 0x91, 0, 0, 0x21, 0xfe, 4, ...ascii('gps!'), 0, 0x3b];
      const file = makeFile(gif, 'anim.gif', 'image/gif');

      expect(await stripMediaMetadata(file)).toBe(file);
    });

    it('returns mp4 files unchanged', async () => {
      const mp4 = [...u32be(0x18), ...ascii('ftypmp42'), ...Array.from({ length: 16 }, () => 0)];
      const file = makeFile(mp4, 'clip.mp4', 'video/mp4');

      expect(await stripMediaMetadata(file)).toBe(file);
    });

    it('returns webm files unchanged', async () => {
      const file = makeFile([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4], 'clip.webm', 'video/webm');

      expect(await stripMediaMetadata(file)).toBe(file);
    });

    it('returns unknown formats unchanged regardless of declared mime type', async () => {
      const file = makeFile(ascii('not an image at all'), 'fake.jpg', 'image/jpeg');

      expect(await stripMediaMetadata(file)).toBe(file);
    });

    it('returns empty files unchanged', async () => {
      const file = makeFile([], 'empty.jpg', 'image/jpeg');

      expect(await stripMediaMetadata(file)).toBe(file);
    });

    it('reads only the header of a format it does not handle', async () => {
      // A large picked video must not be copied into memory just to be passed through.
      const mp4 = [...u32be(0x18), ...ascii('ftypmp42'), ...Array.from({ length: 1024 }, () => 0)];
      const file = makeFile(mp4, 'clip.mp4', 'video/mp4');
      const readWhole = vi.spyOn(file, 'arrayBuffer');
      const slice = vi.spyOn(file, 'slice');

      expect(await stripMediaMetadata(file)).toBe(file);
      expect(readWhole).not.toHaveBeenCalled();
      expect(slice).toHaveBeenCalledWith(0, 16);
    });

    it('returns files over the size cap unchanged without reading them', async () => {
      const file = makeFile(jpegWithMetadata, 'huge.jpg', 'image/jpeg');
      Object.defineProperty(file, 'size', { value: 64 * 1024 * 1024 + 1 });

      expect(await stripMediaMetadata(file)).toBe(file);
    });
  });
});

function indexOfSequence(haystack: number[], needle: number[]): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
