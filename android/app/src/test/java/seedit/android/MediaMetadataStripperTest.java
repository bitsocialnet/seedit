package seedit.android;

import static org.junit.Assert.*;

import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.zip.CRC32;
import org.junit.Test;

/**
 * Unit tests for MediaMetadataStripper. The byte-level fixtures mirror
 * src/lib/media-metadata/__tests__/strip-media-metadata.test.ts (and the
 * Electron copy in electron/strip-media-metadata.test.js) so all
 * implementations stay in lockstep.
 */
public class MediaMetadataStripperTest {

    // --- fixture helpers ---

    private static byte[] bytes(int... values) {
        byte[] out = new byte[values.length];
        for (int i = 0; i < values.length; i++) {
            out[i] = (byte) values[i];
        }
        return out;
    }

    private static byte[] repeat(int value, int count) {
        byte[] out = new byte[count];
        Arrays.fill(out, (byte) value);
        return out;
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) {
            out.write(part, 0, part.length);
        }
        return out.toByteArray();
    }

    private static byte[] ascii(String text) {
        byte[] out = new byte[text.length()];
        for (int i = 0; i < text.length(); i++) {
            out[i] = (byte) text.charAt(i);
        }
        return out;
    }

    private static byte[] u32be(long value) {
        return bytes((int) (value >>> 24) & 0xff, (int) (value >>> 16) & 0xff, (int) (value >>> 8) & 0xff, (int) value & 0xff);
    }

    private static byte[] u32le(long value) {
        return bytes((int) value & 0xff, (int) (value >>> 8) & 0xff, (int) (value >>> 16) & 0xff, (int) (value >>> 24) & 0xff);
    }

    private static int indexOfSequence(byte[] haystack, byte[] needle) {
        outer:
        for (int i = 0; i + needle.length <= haystack.length; i++) {
            for (int j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    continue outer;
                }
            }
            return i;
        }
        return -1;
    }

    // --- JPEG fixtures ---

    private static byte[] jpegSegment(int marker, byte[] payload) {
        int length = payload.length + 2;
        return concat(bytes(0xff, marker, (length >> 8) & 0xff, length & 0xff), payload);
    }

    private static final byte[] SOI = bytes(0xff, 0xd8);
    private static final byte[] APP0_JFIF = jpegSegment(0xe0, concat(ascii("JFIF"), bytes(0, 1, 1, 0, 0, 1, 0, 1, 0, 0)));
    private static final byte[] APP1_EXIF =
            jpegSegment(0xe1, concat(ascii("Exif"), bytes(0, 0), ascii("II*"), bytes(0), ascii("GPSLATITUDE 51.5072")));
    private static final byte[] APP1_XMP = jpegSegment(0xe1, concat(ascii("http://ns.adobe.com/xap/1.0/"), bytes(0), ascii("<x:xmpmeta/>")));
    private static final byte[] APP13_IPTC = jpegSegment(0xed, concat(ascii("Photoshop 3.0"), bytes(0), ascii("8BIM")));
    private static final byte[] APP2_ICC = jpegSegment(0xe2, concat(ascii("ICC_PROFILE"), bytes(0, 1, 1, 9, 9, 9)));
    private static final byte[] COM = jpegSegment(0xfe, ascii("shot on my phone"));
    private static final byte[] DQT = jpegSegment(0xdb, concat(bytes(0), repeat(7, 64)));
    private static final byte[] SOF0 = jpegSegment(0xc0, bytes(8, 0, 1, 0, 1, 1, 0x11, 0x11, 0));
    private static final byte[] DHT = jpegSegment(0xc4, concat(bytes(0), repeat(0, 16), bytes(0x0a)));
    // SOS header, entropy-coded data with 0xff00 stuffing, EOI, deliberately appended payload
    private static final byte[] SOS_TO_EOF =
            concat(bytes(0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0, 0x12, 0xff, 0x00, 0x34, 0xab, 0xff, 0xd9), ascii("APPENDED_PAYLOAD"));

    private static final byte[] JPEG_WITH_METADATA =
            concat(SOI, APP0_JFIF, APP1_EXIF, APP1_XMP, APP13_IPTC, APP2_ICC, COM, DQT, SOF0, DHT, SOS_TO_EOF);
    private static final byte[] JPEG_STRIPPED = concat(SOI, APP0_JFIF, APP2_ICC, DQT, SOF0, DHT, SOS_TO_EOF);

    /** Valid Exif APP1 whose IFD0 holds a Make entry (exercises the walk) and an Orientation entry. */
    private static byte[] exifApp1WithOrientation(int orientation, boolean littleEndian) {
        byte[] tiff =
                littleEndian
                        ? concat(
                                bytes(0x49, 0x49, 0x2a, 0x00), u32le(8), // "II", 42, IFD0 at offset 8
                                bytes(0x02, 0x00), // two entries
                                bytes(0x0f, 0x01, 0x02, 0x00), u32le(4), ascii("abc"), bytes(0x00), // Make, ASCII x4 inline
                                bytes(0x12, 0x01, 0x03, 0x00), u32le(1), bytes(orientation, 0x00, 0x00, 0x00), // Orientation, SHORT x1
                                u32le(0)) // no next IFD
                        : concat(
                                bytes(0x4d, 0x4d, 0x00, 0x2a), u32be(8), // "MM", 42, IFD0 at offset 8
                                bytes(0x00, 0x02),
                                bytes(0x01, 0x0f, 0x00, 0x02), u32be(4), ascii("abc"), bytes(0x00),
                                bytes(0x01, 0x12, 0x00, 0x03), u32be(1), bytes(0x00, orientation, 0x00, 0x00),
                                u32be(0));
        return jpegSegment(0xe1, concat(ascii("Exif"), bytes(0, 0), tiff));
    }

    /** The minimal APP1 the stripper is expected to synthesize (always little-endian). */
    private static byte[] orientationApp1(int orientation) {
        return concat(
                bytes(0xff, 0xe1, 0x00, 0x22),
                ascii("Exif"), bytes(0, 0),
                bytes(0x49, 0x49, 0x2a, 0x00), u32le(8),
                bytes(0x01, 0x00),
                bytes(0x12, 0x01, 0x03, 0x00), u32le(1), bytes(orientation, 0x00, 0x00, 0x00),
                u32le(0));
    }

    // --- PNG fixtures ---

    private static byte[] pngChunk(String type, byte[] data) {
        byte[] typeBytes = ascii(type);
        CRC32 crc = new CRC32();
        crc.update(typeBytes);
        crc.update(data);
        return concat(u32be(data.length), typeBytes, data, u32be(crc.getValue()));
    }

    private static final byte[] PNG_SIGNATURE = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    private static final byte[] IHDR = pngChunk("IHDR", concat(u32be(1), u32be(1), bytes(8, 6, 0, 0, 0)));
    private static final byte[] TEXT = pngChunk("tEXt", concat(ascii("Comment"), bytes(0), ascii("gps: 51.5, -0.1")));
    private static final byte[] ZTXT = pngChunk("zTXt", concat(ascii("Author"), bytes(0, 0, 1, 2, 3)));
    private static final byte[] ITXT = pngChunk("iTXt", concat(ascii("XML:com.adobe.xmp"), bytes(0, 0, 0, 0, 0), ascii("<xmp/>")));
    private static final byte[] EXIF_CHUNK = pngChunk("eXIf", concat(ascii("II*"), bytes(0, 1, 2, 3)));
    private static final byte[] TIME = pngChunk("tIME", bytes(7, 0xe8, 1, 1, 0, 0, 0));
    private static final byte[] UNKNOWN_ANCILLARY = pngChunk("prVt", ascii("secret"));
    private static final byte[] PHYS = pngChunk("pHYs", concat(u32be(2835), u32be(2835), bytes(1)));
    private static final byte[] IDAT = pngChunk("IDAT", bytes(0x78, 0x9c, 1, 2, 3, 4));
    private static final byte[] IEND = pngChunk("IEND", bytes());
    private static final byte[] PNG_TRAILER = ascii("TRAILING_DATA");

    private static final byte[] PNG_WITH_METADATA =
            concat(PNG_SIGNATURE, IHDR, TEXT, ZTXT, ITXT, EXIF_CHUNK, TIME, UNKNOWN_ANCILLARY, PHYS, IDAT, IEND, PNG_TRAILER);
    private static final byte[] PNG_STRIPPED = concat(PNG_SIGNATURE, IHDR, PHYS, IDAT, IEND, PNG_TRAILER);

    // --- WebP fixtures ---

    private static byte[] webpChunk(String fourCc, byte[] data) {
        byte[] padded = data.length % 2 == 1 ? concat(data, bytes(0)) : data;
        return concat(ascii(fourCc), u32le(data.length), padded);
    }

    private static byte[] riffWebp(byte[]... chunks) {
        byte[] payload = concat(chunks);
        return concat(ascii("RIFF"), u32le(4 + payload.length), ascii("WEBP"), payload);
    }

    // flags: ALPHA (0x10) | EXIF (0x08) | XMP (0x04)
    private static final byte[] VP8X = webpChunk("VP8X", bytes(0x1c, 0, 0, 0, 0, 0, 0, 0, 0, 0));
    private static final byte[] VP8X_CLEARED = webpChunk("VP8X", bytes(0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0));
    private static final byte[] ICCP = webpChunk("ICCP", bytes(1, 2, 3, 4, 5)); // odd size exercises padding
    private static final byte[] WEBP_EXIF = webpChunk("EXIF", concat(ascii("II*"), bytes(0, 0x99))); // odd size exercises padding
    private static final byte[] WEBP_XMP = webpChunk("XMP ", ascii("<x:xmpmeta/>"));
    private static final byte[] VP8 = webpChunk("VP8 ", bytes(0x30, 1, 0, 0x9d, 0x01, 0x2a, 1, 0, 1, 0));

    private static final byte[] WEBP_WITH_METADATA = riffWebp(VP8X, ICCP, WEBP_EXIF, WEBP_XMP, VP8);
    private static final byte[] WEBP_STRIPPED = riffWebp(VP8X_CLEARED, ICCP, VP8);

    // flags: ALPHA (0x10) | EXIF (0x08), for a stripped file that keeps its orientation
    private static final byte[] VP8X_EXIF_ONLY = webpChunk("VP8X", bytes(0x18, 0, 0, 0, 0, 0, 0, 0, 0, 0));

    /** A WebP EXIF payload is a bare TIFF block: the APP1 fixtures minus marker, length and "Exif\0\0". */
    private static byte[] exifTiffWithOrientation(int orientation, boolean littleEndian) {
        byte[] app1 = exifApp1WithOrientation(orientation, littleEndian);
        return Arrays.copyOfRange(app1, 10, app1.length);
    }

    private static byte[] orientationWebpExif(int orientation) {
        byte[] app1 = orientationApp1(orientation);
        return webpChunk("EXIF", Arrays.copyOfRange(app1, 10, app1.length));
    }

    private static final byte[] GIF_WITH_COMMENT =
            concat(ascii("GIF89a"), bytes(1, 0, 1, 0, 0x91, 0, 0, 0x21, 0xfe, 4), ascii("gps!"), bytes(0, 0x3b));

    // --- JPEG ---

    @Test
    public void jpeg_removesMetadataSegments_keepsApp0App2AndCodingSegments() {
        assertArrayEquals(JPEG_STRIPPED, MediaMetadataStripper.stripBytes(JPEG_WITH_METADATA));
    }

    @Test
    public void jpeg_copiesSosOnwardVerbatim_includingDataAppendedAfterEoi() {
        byte[] output = MediaMetadataStripper.stripBytes(JPEG_WITH_METADATA);

        assertArrayEquals(SOS_TO_EOF, Arrays.copyOfRange(output, output.length - SOS_TO_EOF.length, output.length));
        byte[] appended = ascii("APPENDED_PAYLOAD");
        assertArrayEquals(appended, Arrays.copyOfRange(output, output.length - appended.length, output.length));
    }

    @Test
    public void jpeg_returnsNullWhenThereIsNoMetadataToRemove() {
        assertNull(MediaMetadataStripper.stripBytes(concat(SOI, APP0_JFIF, DQT, SOF0, DHT, SOS_TO_EOF)));
    }

    @Test
    public void jpeg_returnsNullWhenSegmentLengthOverrunsFile() {
        assertNull(MediaMetadataStripper.stripBytes(concat(SOI, bytes(0xff, 0xe1, 0xff, 0xff, 1, 2, 3))));
    }

    @Test
    public void jpeg_returnsNullWhenSosIsNeverReached() {
        assertNull(MediaMetadataStripper.stripBytes(concat(SOI, APP1_EXIF, DQT)));
    }

    @Test
    public void jpeg_returnsNullWhenMarkerStructureIsInvalid() {
        assertNull(MediaMetadataStripper.stripBytes(concat(SOI, bytes(0x00, 0x01, 0x02, 0x03))));
    }

    @Test
    public void jpeg_reEmitsExifOrientationAsMinimalApp1() {
        byte[] jpeg = concat(SOI, APP0_JFIF, exifApp1WithOrientation(6, true), COM, DQT, SOF0, DHT, SOS_TO_EOF);
        byte[] expected = concat(SOI, orientationApp1(6), APP0_JFIF, DQT, SOF0, DHT, SOS_TO_EOF);
        assertArrayEquals(expected, MediaMetadataStripper.stripBytes(jpeg));
    }

    @Test
    public void jpeg_readsBigEndianExifAndReEmitsLittleEndian() {
        byte[] jpeg = concat(SOI, exifApp1WithOrientation(3, false), DQT, SOF0, DHT, SOS_TO_EOF);
        byte[] expected = concat(SOI, orientationApp1(3), DQT, SOF0, DHT, SOS_TO_EOF);
        assertArrayEquals(expected, MediaMetadataStripper.stripBytes(jpeg));
    }

    @Test
    public void jpeg_doesNotReEmitDefaultOrientation1() {
        byte[] jpeg = concat(SOI, exifApp1WithOrientation(1, true), DQT, SOF0, DHT, SOS_TO_EOF);
        assertArrayEquals(concat(SOI, DQT, SOF0, DHT, SOS_TO_EOF), MediaMetadataStripper.stripBytes(jpeg));
    }

    @Test
    public void jpeg_doesNotReEmitOutOfRangeOrientation() {
        byte[] jpeg = concat(SOI, exifApp1WithOrientation(9, true), DQT, SOF0, DHT, SOS_TO_EOF);
        assertArrayEquals(concat(SOI, DQT, SOF0, DHT, SOS_TO_EOF), MediaMetadataStripper.stripBytes(jpeg));
    }

    // --- PNG ---

    @Test
    public void png_removesMetadataChunks_keepsListedChunks() {
        assertArrayEquals(PNG_STRIPPED, MediaMetadataStripper.stripBytes(PNG_WITH_METADATA));
    }

    @Test
    public void png_keepsCriticalChunksAndDataAppendedAfterIend() {
        byte[] output = MediaMetadataStripper.stripBytes(PNG_WITH_METADATA);

        assertArrayEquals(PNG_SIGNATURE, Arrays.copyOfRange(output, 0, 8));
        for (byte[] chunk : new byte[][] {IHDR, IDAT, IEND}) {
            assertTrue(indexOfSequence(output, chunk) >= 0);
        }
        assertArrayEquals(PNG_TRAILER, Arrays.copyOfRange(output, output.length - PNG_TRAILER.length, output.length));
    }

    @Test
    public void png_returnsNullWhenThereIsNoMetadataToRemove() {
        assertNull(MediaMetadataStripper.stripBytes(concat(PNG_SIGNATURE, IHDR, IDAT, IEND)));
    }

    @Test
    public void png_returnsNullWhenChunkLengthOverrunsFile() {
        assertNull(MediaMetadataStripper.stripBytes(concat(PNG_SIGNATURE, u32be(9999), ascii("tEXt"), bytes(1, 2, 3))));
    }

    @Test
    public void png_returnsNullWhenIendIsMissing() {
        assertNull(MediaMetadataStripper.stripBytes(concat(PNG_SIGNATURE, IHDR, TEXT, IDAT)));
    }

    // --- WebP ---

    @Test
    public void webp_removesExifAndXmpChunks_clearsVp8xFlags_fixesRiffSize() {
        assertArrayEquals(WEBP_STRIPPED, MediaMetadataStripper.stripBytes(WEBP_WITH_METADATA));
    }

    @Test
    public void webp_keepsOnlyTheOrientationTagAsMinimalExifChunk() {
        byte[] input = riffWebp(VP8X, ICCP, VP8, webpChunk("EXIF", exifTiffWithOrientation(6, true)), WEBP_XMP);
        assertArrayEquals(riffWebp(VP8X_EXIF_ONLY, ICCP, VP8, orientationWebpExif(6)), MediaMetadataStripper.stripBytes(input));
    }

    @Test
    public void webp_readsOrientationFromBigEndianExifWithJpegExifHeader() {
        byte[] input = riffWebp(VP8X, VP8, webpChunk("EXIF", concat(ascii("Exif"), bytes(0, 0), exifTiffWithOrientation(8, false))));
        assertArrayEquals(riffWebp(VP8X_EXIF_ONLY, VP8, orientationWebpExif(8)), MediaMetadataStripper.stripBytes(input));
    }

    @Test
    public void webp_doesNotReEmitDefaultOrientation() {
        byte[] input = riffWebp(VP8X, VP8, webpChunk("EXIF", exifTiffWithOrientation(1, true)));
        assertArrayEquals(riffWebp(VP8X_CLEARED, VP8), MediaMetadataStripper.stripBytes(input));
    }

    @Test
    public void webp_clearsVp8xMetadataFlagsEvenWithoutExifOrXmpChunk() {
        assertArrayEquals(riffWebp(VP8X_CLEARED, VP8), MediaMetadataStripper.stripBytes(riffWebp(VP8X, VP8)));
    }

    @Test
    public void webp_returnsNullWhenThereIsNoMetadataToRemove() {
        assertNull(MediaMetadataStripper.stripBytes(riffWebp(VP8)));
    }

    @Test
    public void webp_returnsNullWhenRiffSizeOverrunsFile() {
        assertNull(MediaMetadataStripper.stripBytes(concat(ascii("RIFF"), u32le(9999), ascii("WEBP"), VP8)));
    }

    @Test
    public void webp_returnsNullWhenChunkOverrunsRiffPayload() {
        assertNull(MediaMetadataStripper.stripBytes(riffWebp(Arrays.copyOf(webpChunk("EXIF", bytes(1, 2)), 8))));
    }

    // --- pass-through formats ---

    @Test
    public void passThrough_returnsNullForGif() {
        assertNull(MediaMetadataStripper.stripBytes(GIF_WITH_COMMENT));
    }

    @Test
    public void passThrough_returnsNullForMp4() {
        assertNull(MediaMetadataStripper.stripBytes(concat(u32be(0x18), ascii("ftypmp42"), repeat(0, 16))));
    }

    @Test
    public void passThrough_returnsNullForWebm() {
        assertNull(MediaMetadataStripper.stripBytes(bytes(0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4)));
    }

    @Test
    public void passThrough_returnsNullForUnknownFormats() {
        assertNull(MediaMetadataStripper.stripBytes(ascii("not an image at all")));
    }

    @Test
    public void passThrough_returnsNullForEmptyInput() {
        assertNull(MediaMetadataStripper.stripBytes(bytes()));
    }

    // --- header sniffing helpers used by the plugin's read path ---

    @Test
    public void isStrippableFormat_recognizesJpegPngWebpHeaders() {
        assertTrue(MediaMetadataStripper.isStrippableFormat(JPEG_WITH_METADATA, 16));
        assertTrue(MediaMetadataStripper.isStrippableFormat(PNG_WITH_METADATA, 16));
        assertTrue(MediaMetadataStripper.isStrippableFormat(WEBP_WITH_METADATA, 16));
    }

    @Test
    public void isStrippableFormat_rejectsPassThroughFormatsAndShortHeaders() {
        assertFalse(MediaMetadataStripper.isStrippableFormat(GIF_WITH_COMMENT, 16));
        assertFalse(MediaMetadataStripper.isStrippableFormat(JPEG_WITH_METADATA, 3)); // jpeg needs at least 4 bytes
        assertFalse(MediaMetadataStripper.isStrippableFormat(WEBP_WITH_METADATA, 15)); // webp needs at least 16 bytes
        assertFalse(MediaMetadataStripper.isStrippableFormat(bytes(), 0));
    }

    @Test
    public void sniffMimeType_reportsMimeByMagicBytes() {
        assertEquals("image/jpeg", MediaMetadataStripper.sniffMimeType(JPEG_STRIPPED));
        assertEquals("image/png", MediaMetadataStripper.sniffMimeType(PNG_STRIPPED));
        assertEquals("image/webp", MediaMetadataStripper.sniffMimeType(WEBP_STRIPPED));
        assertNull(MediaMetadataStripper.sniffMimeType(GIF_WITH_COMMENT));
    }
}
