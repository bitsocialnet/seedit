package seedit.android;

import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Media metadata stripping for files picked on the device, where the native
 * plugin uploads directly and the renderer-side stripper never sees the bytes
 * (parity with src/lib/media-metadata/strip-media-metadata.ts — keep the two
 * byte-level implementations in sync). Removes privacy-sensitive metadata
 * (EXIF/GPS, XMP, IPTC, comments) from JPEG/PNG/WebP before any upload
 * provider sees the bytes. Containers are rewritten losslessly; pixel data is
 * never re-encoded, so the JPEG Exif Orientation tag (rotation lives in
 * metadata, not pixels) is re-emitted as a minimal APP1 to keep photos from
 * rendering sideways. GIF, video, and unknown formats are not handled, and any
 * parse anomaly returns null so callers upload the original unchanged and an
 * upload is never blocked.
 *
 * <p>Deliberately pure Java (no android.* imports) so it runs in JVM unit tests.
 */
final class MediaMetadataStripper {

    /** Files larger than this pass through untouched to avoid large in-memory copies. */
    static final int MAX_PROCESSABLE_BYTES = 64 * 1024 * 1024;

    private static final int[] PNG_SIGNATURE = {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};

    /**
     * PNG ancillary chunks kept because they affect rendering (plus APNG frames).
     * Critical chunks are always kept; ancillary chunks not listed here (tEXt,
     * zTXt, iTXt, eXIf, tIME, and unknown ones) are dropped.
     */
    private static final Set<String> PNG_KEPT_ANCILLARY_CHUNKS =
            new HashSet<>(
                    Arrays.asList(
                            "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "bKGD", "pHYs", "acTL",
                            "fcTL", "fdAT"));

    /** VP8X header flag bits announcing EXIF (0x08) and XMP (0x04) chunks. */
    private static final int WEBP_VP8X_METADATA_FLAGS = 0x0c;

    /** "Exif\0\0" — the payload prefix distinguishing an Exif APP1 from XMP. */
    private static final int[] EXIF_APP1_HEADER = {0x45, 0x78, 0x69, 0x66, 0x00, 0x00};

    private MediaMetadataStripper() {}

    /**
     * True when the leading {@code length} bytes denote a format stripBytes handles
     * (JPEG, PNG, WebP), so callers can skip reading GIF/video/unknown files fully.
     */
    static boolean isStrippableFormat(byte[] bytes, int length) {
        return isJpeg(bytes, length) || isPng(bytes, length) || isWebp(bytes, length);
    }

    /** Mime type by magic bytes for the formats stripBytes handles, or null. */
    static String sniffMimeType(byte[] bytes) {
        if (isJpeg(bytes, bytes.length)) return "image/jpeg";
        if (isPng(bytes, bytes.length)) return "image/png";
        if (isWebp(bytes, bytes.length)) return "image/webp";
        return null;
    }

    /**
     * Detects the format by magic bytes (mime/extension are never trusted) and
     * returns a stripped copy, or null meaning "keep original".
     */
    static byte[] stripBytes(byte[] bytes) {
        if (isJpeg(bytes, bytes.length)) {
            return stripJpeg(bytes);
        }
        if (isPng(bytes, bytes.length)) {
            return stripPng(bytes);
        }
        if (isWebp(bytes, bytes.length)) {
            return stripWebp(bytes);
        }
        // GIF passes through deliberately (rewriting animations is risky and GIFs
        // carry no GPS-class metadata); video and unknown formats pass through too.
        return null;
    }

    private static boolean isJpeg(byte[] bytes, int length) {
        return length >= 4 && u8(bytes, 0) == 0xff && u8(bytes, 1) == 0xd8 && u8(bytes, 2) == 0xff;
    }

    private static boolean isPng(byte[] bytes, int length) {
        if (length < 8) {
            return false;
        }
        for (int i = 0; i < PNG_SIGNATURE.length; i++) {
            if (u8(bytes, i) != PNG_SIGNATURE[i]) {
                return false;
            }
        }
        return true;
    }

    private static boolean isWebp(byte[] bytes, int length) {
        return length >= 16 && "RIFF".equals(readFourCc(bytes, 0)) && "WEBP".equals(readFourCc(bytes, 8));
    }

    private static byte[] stripJpeg(byte[] bytes) {
        int len = bytes.length;
        ByteArrayOutputStream kept = new ByteArrayOutputStream(len);
        kept.write(bytes, 0, 2);
        int removedBytes = 0;
        int orientation = 0;
        int pos = 2;

        for (; ; ) {
            if (pos + 1 >= len || u8(bytes, pos) != 0xff) return null;
            // A marker may be preceded by any number of 0xff fill bytes.
            int markerPos = pos + 1;
            while (markerPos < len && u8(bytes, markerPos) == 0xff) markerPos++;
            if (markerPos >= len) return null;
            int marker = u8(bytes, markerPos);

            if (marker == 0xda) {
                // SOS: entropy-coded data follows and contains 0xff bytes that are not
                // segment markers, so copy verbatim to EOF instead of parsing. This
                // also preserves data deliberately appended after EOI. Marker segments
                // after the first SOS are deliberately left untouched: cameras write
                // metadata before the first scan, and parsing entropy-coded data risks
                // degrading exotic-but-valid files (e.g. motion-photo trailers) into
                // full pass-through, which would strip less than this does.
                kept.write(bytes, pos, len - pos);
                break;
            }
            // Standalone markers (TEM, RST, SOI, EOI) are not expected before SOS.
            if (marker == 0x00 || marker == 0x01 || (marker >= 0xd0 && marker <= 0xd9)) return null;

            if (markerPos + 2 >= len) return null;
            int segmentLength = (u8(bytes, markerPos + 1) << 8) | u8(bytes, markerPos + 2);
            if (segmentLength < 2) return null;
            long end = (long) markerPos + 1 + segmentLength;
            if (end > len) return null;

            // Dropped segments: APP1 (Exif and XMP), APP13 (IPTC/Photoshop), COM.
            if (marker == 0xe1 || marker == 0xed || marker == 0xfe) {
                if (marker == 0xe1 && orientation == 0 && isExifApp1Payload(bytes, markerPos + 3, (int) end)) {
                    orientation = readExifOrientation(bytes, markerPos + 9, (int) end);
                }
                removedBytes += (int) end - pos;
            } else {
                kept.write(bytes, pos, (int) end - pos);
            }
            pos = (int) end;
        }

        if (removedBytes == 0) return null;
        byte[] out = kept.toByteArray();
        if (orientation < 2 || orientation > 8) return out;
        // Rotation lives in metadata, not pixels: re-emit the Orientation tag (and
        // nothing else) as a minimal APP1 after SOI so photos don't render sideways.
        byte[] segment = buildOrientationApp1(orientation);
        byte[] withOrientation = new byte[out.length + segment.length];
        System.arraycopy(out, 0, withOrientation, 0, 2);
        System.arraycopy(segment, 0, withOrientation, 2, segment.length);
        System.arraycopy(out, 2, withOrientation, 2 + segment.length, out.length - 2);
        return withOrientation;
    }

    private static boolean isExifApp1Payload(byte[] bytes, int start, int end) {
        if (start + EXIF_APP1_HEADER.length > end) {
            return false;
        }
        for (int i = 0; i < EXIF_APP1_HEADER.length; i++) {
            if (u8(bytes, start + i) != EXIF_APP1_HEADER[i]) {
                return false;
            }
        }
        return true;
    }

    /** Reads the Orientation tag (1-8) from IFD0 of an Exif TIFF block, or 0 when absent or malformed. */
    private static int readExifOrientation(byte[] bytes, int tiffStart, int end) {
        if (tiffStart + 8 > end) return 0;
        boolean little;
        if (u8(bytes, tiffStart) == 0x49 && u8(bytes, tiffStart + 1) == 0x49) little = true;
        else if (u8(bytes, tiffStart) == 0x4d && u8(bytes, tiffStart + 1) == 0x4d) little = false;
        else return 0;
        if (readTiffU16(bytes, tiffStart + 2, little) != 42) return 0;
        long ifdOffset = readTiffU32(bytes, tiffStart + 4, little);
        if (ifdOffset < 8) return 0;
        long ifdPos = tiffStart + ifdOffset;
        if (ifdPos + 2 > end) return 0;
        int entryCount = readTiffU16(bytes, (int) ifdPos, little);
        for (int i = 0; i < entryCount; i++) {
            long entry = ifdPos + 2 + i * 12L;
            if (entry + 12 > end) return 0;
            if (readTiffU16(bytes, (int) entry, little) != 0x0112) continue;
            // Orientation must be a single SHORT; the value sits in the first two payload bytes.
            if (readTiffU16(bytes, (int) entry + 2, little) != 3) return 0;
            if (readTiffU32(bytes, (int) entry + 4, little) != 1) return 0;
            int value = readTiffU16(bytes, (int) entry + 8, little);
            return value >= 1 && value <= 8 ? value : 0;
        }
        return 0;
    }

    private static int readTiffU16(byte[] bytes, int pos, boolean little) {
        return little ? u8(bytes, pos) | (u8(bytes, pos + 1) << 8) : (u8(bytes, pos) << 8) | u8(bytes, pos + 1);
    }

    private static long readTiffU32(byte[] bytes, int pos, boolean little) {
        return little
                ? u8(bytes, pos)
                        | ((long) u8(bytes, pos + 1) << 8)
                        | ((long) u8(bytes, pos + 2) << 16)
                        | ((long) u8(bytes, pos + 3) << 24)
                : ((long) u8(bytes, pos) << 24)
                        | ((long) u8(bytes, pos + 1) << 16)
                        | ((long) u8(bytes, pos + 2) << 8)
                        | u8(bytes, pos + 3);
    }

    /** Minimal little-endian Exif APP1 whose IFD0 holds only the Orientation tag. */
    private static byte[] buildOrientationApp1(int orientation) {
        return new byte[] {
            (byte) 0xff, (byte) 0xe1, 0x00, 0x22, // APP1, length 34
            0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
            0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // "II", 42, IFD0 at offset 8
            0x01, 0x00, // one IFD entry
            0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, (byte) orientation, 0x00, 0x00, 0x00, // Orientation, SHORT x1
            0x00, 0x00, 0x00, 0x00, // no next IFD
        };
    }

    private static byte[] stripPng(byte[] bytes) {
        int len = bytes.length;
        ByteArrayOutputStream kept = new ByteArrayOutputStream(len);
        kept.write(bytes, 0, 8);
        int removedBytes = 0;
        int pos = 8;

        for (; ; ) {
            if (pos + 8 > len) return null; // ran out of bytes before IEND
            long dataLength = readU32be(bytes, pos);
            if (dataLength > 0x7fffffffL) return null;
            long end = pos + 12L + dataLength; // length + type + data + CRC
            if (end > len) return null;
            String type = readFourCc(bytes, pos + 4);

            if ("IEND".equals(type)) {
                // Keep IEND and any deliberately appended trailing data verbatim.
                kept.write(bytes, pos, len - pos);
                break;
            }

            boolean isCritical = (u8(bytes, pos + 4) & 0x20) == 0;
            if (isCritical || PNG_KEPT_ANCILLARY_CHUNKS.contains(type)) {
                // Chunks are copied whole so their CRCs remain valid.
                kept.write(bytes, pos, (int) end - pos);
            } else {
                removedBytes += (int) end - pos;
            }
            pos = (int) end;
        }

        if (removedBytes == 0) return null;
        return kept.toByteArray();
    }

    private static byte[] stripWebp(byte[] bytes) {
        int len = bytes.length;
        long riffEnd = 8 + readU32le(bytes, 4);
        if (riffEnd < 12 || riffEnd > len) return null;

        ByteArrayOutputStream kept = new ByteArrayOutputStream(len);
        kept.write(bytes, 0, 12);
        int outLength = 12;
        int removedBytes = 0;
        int vp8xFlagsOffset = -1;
        boolean vp8xHasMetadataFlags = false;
        int pos = 12;

        while (pos < riffEnd) {
            if (pos + 8 > riffEnd) return null;
            String fourCc = readFourCc(bytes, pos);
            long chunkSize = readU32le(bytes, pos + 4);
            long end = pos + 8 + chunkSize + (chunkSize & 1); // chunks are padded to even sizes
            if (end > riffEnd) return null;

            if ("EXIF".equals(fourCc) || "XMP ".equals(fourCc)) {
                removedBytes += (int) end - pos;
            } else {
                if ("VP8X".equals(fourCc)) {
                    if (chunkSize < 10) return null;
                    vp8xFlagsOffset = outLength + 8;
                    vp8xHasMetadataFlags = (u8(bytes, pos + 8) & WEBP_VP8X_METADATA_FLAGS) != 0;
                }
                kept.write(bytes, pos, (int) end - pos);
                outLength += (int) end - pos;
            }
            pos = (int) end;
        }

        if (removedBytes == 0 && !vp8xHasMetadataFlags) return null;

        if (riffEnd < len) kept.write(bytes, (int) riffEnd, len - (int) riffEnd); // keep appended trailing data
        byte[] out = kept.toByteArray();
        writeU32le(out, 4, outLength - 8);
        if (vp8xFlagsOffset >= 0) out[vp8xFlagsOffset] &= (byte) ~WEBP_VP8X_METADATA_FLAGS;
        return out;
    }

    private static int u8(byte[] bytes, int pos) {
        return bytes[pos] & 0xff;
    }

    private static String readFourCc(byte[] bytes, int pos) {
        return new String(
                new char[] {
                    (char) u8(bytes, pos),
                    (char) u8(bytes, pos + 1),
                    (char) u8(bytes, pos + 2),
                    (char) u8(bytes, pos + 3)
                });
    }

    private static long readU32be(byte[] bytes, int pos) {
        return ((long) u8(bytes, pos) << 24)
                | ((long) u8(bytes, pos + 1) << 16)
                | ((long) u8(bytes, pos + 2) << 8)
                | u8(bytes, pos + 3);
    }

    private static long readU32le(byte[] bytes, int pos) {
        return u8(bytes, pos)
                | ((long) u8(bytes, pos + 1) << 8)
                | ((long) u8(bytes, pos + 2) << 16)
                | ((long) u8(bytes, pos + 3) << 24);
    }

    private static void writeU32le(byte[] bytes, int pos, int value) {
        bytes[pos] = (byte) (value & 0xff);
        bytes[pos + 1] = (byte) ((value >>> 8) & 0xff);
        bytes[pos + 2] = (byte) ((value >>> 16) & 0xff);
        bytes[pos + 3] = (byte) ((value >>> 24) & 0xff);
    }
}
