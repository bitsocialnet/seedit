package seedit.android;

import static org.junit.Assert.*;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import org.junit.Test;

public class MediaUploadAutomationRunnerTest {

    /** Counts what the reader pulls, to show it stops early on a large file. */
    private static final class CountingStream extends InputStream {
        private final long size;
        long read;

        CountingStream(long size) {
            this.size = size;
        }

        @Override
        public int read() {
            if (read >= size) return -1;
            read++;
            return 0;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) {
            if (read >= size) return -1;
            int count = (int) Math.min(length, size - read);
            read += count;
            return count;
        }
    }

    @Test
    public void readUpTo_returnsTheWholeFileWithinTheLimit() throws IOException {
        byte[] file = new byte[100_000];
        file[99_999] = 7;
        assertArrayEquals(file, MediaUploadAutomationRunner.readUpTo(new ByteArrayInputStream(file), 100_000));
    }

    @Test
    public void readUpTo_stopsSoonAfterTheLimitSoTheCallerCanRejectTheFile() throws IOException {
        CountingStream stream = new CountingStream(1_000_000_000L);
        byte[] bytes = MediaUploadAutomationRunner.readUpTo(stream, 100_000);

        assertTrue(bytes.length > 100_000);
        assertTrue(stream.read < 120_000);
    }
}
