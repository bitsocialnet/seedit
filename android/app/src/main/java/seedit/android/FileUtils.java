package seedit.android;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.UUID;
import java.util.regex.Pattern;

public class FileUtils {
    private static final int MAX_FILENAME_LENGTH = 255;
    private static final Pattern UNSAFE_CHARS = Pattern.compile("[^a-zA-Z0-9._-]");

    public static File getFileFromUri(Context context, Uri uri) throws Exception {
        if ("file".equals(uri.getScheme()) && uri.getPath() != null) {
            File source = new File(uri.getPath());
            if (source.isFile()) {
                return source;
            }
        }

        String fileName = getFileName(context, uri);
        String sanitizedName = sanitizeFileName(fileName);
        File file = new File(context.getCacheDir(), sanitizedName);

        try (InputStream inputStream = context.getContentResolver().openInputStream(uri)) {
            if (inputStream == null) {
                throw new java.io.IOException("Unable to open input stream for URI: " + uri);
            }
            try (FileOutputStream outputStream = new FileOutputStream(file)) {
                byte[] buffer = new byte[4096];
                int length;
                while ((length = inputStream.read(buffer)) > 0) {
                    outputStream.write(buffer, 0, length);
                }
                outputStream.flush();
            } catch (java.io.IOException e) {
                // A partial copy (a full disk, a provider that stopped mid-read) is never used.
                file.delete();
                throw e;
            }
            return file;
        }
    }

    static String getFileName(Context context, Uri uri) {
        String result = null;
        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = context.getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int columnIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (columnIndex != -1) {
                        result = cursor.getString(columnIndex);
                    }
                }
            }
        }
        if (result == null) {
            String path = uri.getPath();
            if (path != null) {
                path = path.replaceAll("/+$", "");
                int cut = path.lastIndexOf('/');
                result = (cut != -1) ? path.substring(cut + 1) : path;
                if (result.isEmpty()) {
                    result = "unknown";
                }
            } else {
                result = "unknown";
            }
        }
        return result;
    }

    /** Writes bytes to a uniquely named cache file that keeps the sanitized name's extension. */
    public static File writeBytesToCacheFile(Context context, String fileName, byte[] bytes) throws Exception {
        String safeName = sanitizeFileName(fileName);
        int dot = safeName.lastIndexOf('.');
        String base = dot > 0 ? safeName.substring(0, dot) : safeName;
        String ext = dot > 0 ? safeName.substring(dot) : null;
        if (base.length() < 3) {
            base = (base + "___").substring(0, 3);
        }
        if (base.length() > 64) {
            base = base.substring(0, 64);
        }
        File file = File.createTempFile(base + "-", ext, context.getCacheDir());
        try (FileOutputStream outputStream = new FileOutputStream(file)) {
            outputStream.write(bytes);
            outputStream.flush();
        }
        return file;
    }

    /**
     * Sanitize a filename to prevent path traversal and invalid characters.
     * Takes only the last path segment, removes/replaces unsafe chars, enforces max length,
     * and falls back to a UUID if the result is empty.
     */
    static String sanitizeFileName(String fileName) {
        if (fileName == null || fileName.isEmpty()) {
            return UUID.randomUUID().toString();
        }
        String basename = new File(fileName).getName();
        basename = basename.replace("..", "");
        basename = UNSAFE_CHARS.matcher(basename).replaceAll("_");
        basename = basename.trim();
        if (basename.isEmpty() || basename.length() > MAX_FILENAME_LENGTH) {
            return UUID.randomUUID().toString();
        }
        return basename;
    }
}
