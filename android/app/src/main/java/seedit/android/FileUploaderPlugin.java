package seedit.android;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.appcompat.app.AppCompatActivity;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.json.JSONArray;

@CapacitorPlugin(name = "FileUploader")
public class FileUploaderPlugin extends Plugin {
    private static final String TAG = "FileUploaderPlugin";

    private static final String PROVIDER_CATBOX = "catbox";
    private static final long CATBOX_TIMEOUT_SEC = 30;
    /** Covers a large video, audio file or PDF on a slow uplink; the idle timeout above still ends a stalled upload. */
    private static final long CATBOX_CALL_TIMEOUT_SEC = 300;
    private static final int MAX_GENERATED_UPLOAD_BYTES = 20 * 1024 * 1024;
    /** Content URIs returned by pickMedia, keyed by the opaque id handed to the web layer. */
    private final Map<String, Uri> pickedMediaUris = new ConcurrentHashMap<>();

    @PluginMethod
    public void pickMedia(PluginCall call) {
        Log.d(TAG, "pickMedia called");
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("*/*");
        // The web layer passes the kinds of file the enabled providers host (e.g. image/*, application/pdf).
        List<String> mimeTypes = new ArrayList<>();
        JSArray requested = call.getArray("mimeTypes");
        if (requested != null) {
            for (int i = 0; i < requested.length(); i++) {
                String mimeType = requested.optString(i, null);
                if (mimeType != null && !mimeType.trim().isEmpty()) {
                    mimeTypes.add(mimeType);
                }
            }
        }
        if (mimeTypes.isEmpty()) {
            mimeTypes.add("image/*");
            mimeTypes.add("video/*");
        }
        intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toArray(new String[0]));
        startActivityForResult(call, intent, "pickMediaResult");
    }

    /**
     * Uploads a file chosen with pickMedia, identified by the id that call returned. Only
     * user-picked URIs can be uploaded: the web layer never passes a URI, so it cannot make
     * the plugin read other content the app has access to.
     */
    @PluginMethod
    public void uploadPickedMedia(PluginCall call) {
        Log.d(TAG, "uploadPickedMedia called");
        List<String> providerOrder = getProviderOrder(call);
        if (providerOrder.isEmpty()) {
            call.reject("No supported upload providers selected");
            return;
        }
        String id = call.getString("id");
        Uri uri = id != null ? pickedMediaUris.get(id) : null;
        if (uri == null) {
            call.reject("Picked file is no longer available. Choose it again.");
            return;
        }
        new Thread(() -> uploadPickedUri(uri, providerOrder, call)).start();
    }

    @PluginMethod
    public void uploadGeneratedMedia(PluginCall call) {
        Log.d(TAG, "uploadGeneratedMedia called");
        List<String> providerOrder = getProviderOrder(call);
        if (providerOrder.isEmpty()) {
            call.reject("No supported upload providers selected");
            return;
        }

        String base64 = call.getString("base64");
        if (base64 == null || base64.trim().isEmpty()) {
            call.reject("Generated upload data is required");
            return;
        }
        int commaIndex = base64.indexOf(',');
        String base64Payload = commaIndex >= 0 ? base64.substring(commaIndex + 1) : base64;
        byte[] bytes;
        try {
            bytes = Base64.decode(base64Payload, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Generated upload data is invalid");
            return;
        }
        if (bytes.length == 0) {
            call.reject("Generated upload data is empty");
            return;
        }
        if (bytes.length > MAX_GENERATED_UPLOAD_BYTES) {
            call.reject("Generated upload is too large");
            return;
        }

        String fileName = call.getString("fileName", "upload");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        new Thread(
                        () -> {
                            File cachedFile = null;
                            try {
                                cachedFile = FileUtils.writeBytesToCacheFile(getContext(), fileName, bytes);
                                tryProvidersSequentially(Uri.fromFile(cachedFile), providerOrder, call, fileName, bytes, mimeType);
                            } catch (Throwable e) {
                                // Throwable, not Exception: an OutOfMemoryError must still
                                // settle the call or the web layer awaits it forever.
                                Log.e(TAG, "Generated upload failed", e);
                                try {
                                    call.reject("Upload failed: " + e.getMessage());
                                } catch (Exception rejectEx) {
                                    Log.e(TAG, "Failed to reject generated upload call", rejectEx);
                                }
                            } finally {
                                if (cachedFile != null && cachedFile.exists() && !cachedFile.delete()) {
                                    Log.w(TAG, "Could not delete generated upload cache file: " + cachedFile.getAbsolutePath());
                                }
                            }
                        })
                .start();
    }

    private List<String> parseProviderOrder(PluginCall call) {
        List<String> order = new ArrayList<>();
        JSArray arr = call.getArray("providerOrder");
        if (arr != null) {
            for (int i = 0; i < arr.length(); i++) {
                try {
                    Object o = arr.get(i);
                    if (o instanceof String) {
                        String p = (String) o;
                        if (PROVIDER_CATBOX.equals(p)) {
                            order.add(p);
                        } else if (MediaUploadRecipes.isAndroidUploadProvider(p)) {
                            order.add(p);
                        } else if (MediaUploadRecipes.PROVIDER_IMGUR.equals(p)) {
                            Log.d(TAG, "Skipping unsupported Android upload provider: " + p);
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Skip invalid provider at " + i, e);
                }
            }
        }
        return order;
    }

    private List<String> getProviderOrder(PluginCall call) {
        List<String> providerOrder = parseProviderOrder(call);
        if (providerOrder.isEmpty() && call.getArray("providerOrder") == null) {
            providerOrder.add(PROVIDER_CATBOX);
        }
        return providerOrder;
    }

    @ActivityCallback
    private void pickMediaResult(PluginCall call, ActivityResult result) {
        Log.d(TAG, "pickMediaResult callback received");
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("File selection cancelled");
            return;
        }

        Intent data = result.getData();
        if (data == null) {
            call.reject("No data received");
            return;
        }

        Uri uri = data.getData();
        if (uri == null) {
            call.reject("No URI received");
            return;
        }

        // The read grant from ACTION_GET_CONTENT lasts for this activity, so the file can be
        // uploaded later, when the post is submitted.
        String id = UUID.randomUUID().toString();
        pickedMediaUris.put(id, uri);
        String mimeType = null;
        try {
            mimeType = getContext().getContentResolver().getType(uri);
        } catch (Exception e) {
            Log.w(TAG, "Could not query picked file type", e);
        }
        JSObject ret = new JSObject();
        ret.put("id", id);
        ret.put("fileName", getDisplayName(uri));
        ret.put("mimeType", mimeType != null ? mimeType : "");
        ret.put("webPath", getWebPath(uri));
        call.resolve(ret);
    }

    /**
     * URL the WebView reads the picked file from through Capacitor's local server (as
     * Capacitor.convertFileSrc builds it), so a web-side upload such as Forge Images streams the
     * file instead of copying it across the bridge as base64.
     */
    private String getWebPath(Uri uri) {
        String localUrl = getBridge().getLocalUrl();
        String uriString = uri.toString();
        if (uriString.startsWith("file://")) {
            return localUrl + uriString.replace("file://", Bridge.CAPACITOR_FILE_START);
        }
        return localUrl + uriString.replace("content:/", Bridge.CAPACITOR_CONTENT_START);
    }

    /** Uploads a picked file, metadata-stripped when possible. Runs off the main thread. */
    private void uploadPickedUri(Uri uri, List<String> providerOrder, PluginCall call) {
        File strippedFile = null;
        try {
            StrippedPickedMedia stripped = stripPickedMediaMetadata(uri);
            if (stripped == null) {
                tryProvidersSequentially(uri, providerOrder, call);
                return;
            }
            // Route stripped images like a generated upload (cache file for
            // catbox, bytes for WebView injection) so the original picked URI
            // is never handed to a provider page. Display name and mime type
            // stay those of the original file.
            strippedFile = FileUtils.writeBytesToCacheFile(getContext(), stripped.fileName, stripped.bytes);
            tryProvidersSequentially(
                    Uri.fromFile(strippedFile),
                    providerOrder,
                    call,
                    stripped.fileName,
                    stripped.bytes,
                    stripped.mimeType);
        } catch (Throwable e) {
            // Throwable, not Exception: an OutOfMemoryError must still
            // settle the call or the web layer awaits it forever.
            Log.e(TAG, "Upload failed", e);
            try {
                call.reject("Upload failed: " + e.getMessage());
            } catch (Exception rejectEx) {
                Log.e(TAG, "Failed to reject call", rejectEx);
            }
        } finally {
            if (strippedFile != null && strippedFile.exists() && !strippedFile.delete()) {
                Log.w(TAG, "Could not delete stripped upload cache file: " + strippedFile.getAbsolutePath());
            }
        }
    }

    /** Display name from the content provider as the user sees it; getFileName below makes it safe for the cache and provider pages. */
    private String getDisplayName(Uri uri) {
        try {
            return FileUtils.getFileName(getContext(), uri);
        } catch (Exception e) {
            Log.w(TAG, "Could not query picked file name", e);
            return "unknown";
        }
    }

    /** Stripped copy of a picked file plus the original file's display name and mime type. */
    private static final class StrippedPickedMedia {
        final byte[] bytes;
        final String fileName;
        final String mimeType;

        StrippedPickedMedia(byte[] bytes, String fileName, String mimeType) {
            this.bytes = bytes;
            this.fileName = fileName;
            this.mimeType = mimeType;
        }
    }

    /**
     * Reads a picked JPEG/PNG/WebP and returns a losslessly metadata-stripped copy
     * (EXIF/GPS, XMP, IPTC, comments removed). Returns null when the file should
     * upload unchanged instead: GIF, video, or unknown formats, files over the
     * size cap, files with nothing to remove, or any read/parse failure —
     * stripping must never break an upload.
     */
    private StrippedPickedMedia stripPickedMediaMetadata(Uri uri) {
        try {
            byte[] original = readStrippableBytes(uri);
            if (original == null) {
                return null;
            }
            byte[] strippedBytes = MediaMetadataStripper.stripBytes(original);
            if (strippedBytes == null) {
                return null;
            }
            String mimeType = getContext().getContentResolver().getType(uri);
            if (mimeType == null || mimeType.isEmpty()) {
                mimeType = MediaMetadataStripper.sniffMimeType(strippedBytes);
            }
            return new StrippedPickedMedia(strippedBytes, getFileName(uri), mimeType);
        } catch (Throwable e) {
            // Throwable, not Exception: stripping a near-cap image can throw
            // OutOfMemoryError, which must fall back to the original upload.
            Log.w(TAG, "Metadata strip failed, uploading picked file unchanged", e);
            return null;
        }
    }

    /**
     * Fully reads the picked file when its magic bytes denote a strippable image
     * within the size cap; returns null otherwise so GIF/video/unknown files are
     * never loaded into memory.
     */
    private byte[] readStrippableBytes(Uri uri) throws Exception {
        long sizeHint = queryContentSize(uri);
        if (sizeHint > MediaMetadataStripper.MAX_PROCESSABLE_BYTES) {
            return null; // over the size cap: pass through without reading
        }
        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) {
                return null;
            }
            byte[] header = new byte[16];
            int headerLength = 0;
            while (headerLength < header.length) {
                int read = input.read(header, headerLength, header.length - headerLength);
                if (read == -1) {
                    break;
                }
                headerLength += read;
            }
            if (!MediaMetadataStripper.isStrippableFormat(header, headerLength)) {
                return null;
            }
            // Pre-size with the reported size to avoid the transient 2x cost of
            // growth-doubling; a wrong hint self-corrects (the stream grows) and
            // the cap check below still bounds providers that under-report.
            ByteArrayOutputStream out = new ByteArrayOutputStream(sizeHint > 0 ? (int) sizeHint : 256 * 1024);
            out.write(header, 0, headerLength);
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                if (out.size() + read > MediaMetadataStripper.MAX_PROCESSABLE_BYTES) {
                    return null;
                }
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        }
    }

    /** Size in bytes reported by the content provider or filesystem, or -1 when unknown. */
    private long queryContentSize(Uri uri) {
        if ("file".equals(uri.getScheme())) {
            String path = uri.getPath();
            long length = path != null ? new File(path).length() : 0;
            return length > 0 ? length : -1;
        }
        try (Cursor cursor =
                getContext()
                        .getContentResolver()
                        .query(uri, new String[] {OpenableColumns.SIZE}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) {
                long size = cursor.getLong(0);
                return size > 0 ? size : -1;
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not query picked file size", e);
        }
        return -1;
    }

    private void tryProvidersSequentially(Uri fileUri, List<String> providerOrder, PluginCall call) {
        tryProvidersSequentially(fileUri, providerOrder, call, null, null, null);
    }

    private void tryProvidersSequentially(
            Uri fileUri,
            List<String> providerOrder,
            PluginCall call,
            String generatedFileName,
            byte[] generatedFileBytes,
            String generatedMimeType) {
        List<JSObject> attempts = new ArrayList<>();
        StringBuilder errorSummary = new StringBuilder();
        String fileName = generatedFileName != null ? generatedFileName : getFileName(fileUri);

        for (String provider : providerOrder) {
            JSObject attempt = new JSObject();
            attempt.put("provider", provider);

            if (PROVIDER_CATBOX.equals(provider)) {
                MediaUploadResult res = uploadToCatboxSync(fileUri);
                attempt.put("success", res.success);
                if (res.success) {
                    attempt.put("url", res.url);
                    attempts.add(attempt);
                    resolveWithSuccess(call, res.url, fileName, provider, attempts);
                    return;
                }
                attempt.put("error", res.error);
                errorSummary.append(provider).append(": ").append(res.error).append("; ");
            } else if (MediaUploadRecipes.isWebViewProvider(provider)) {
                MediaUploadResult res =
                        generatedFileBytes != null
                                ? uploadGeneratedViaWebViewSync(generatedFileBytes, fileName, generatedMimeType, provider)
                                : uploadViaWebViewSync(fileUri, provider);
                attempt.put("success", res.success);
                if (res.success) {
                    attempt.put("url", res.url);
                    attempts.add(attempt);
                    resolveWithSuccess(call, res.url, fileName, provider, attempts);
                    return;
                }
                attempt.put("error", res.error);
                attempt.put("stage", res.stage != null ? res.stage : "");
                attempt.put("elapsedMs", res.elapsedMs);
                attempt.put("matchedSelectors", res.matchedSelectors != null ? res.matchedSelectors : "");
                if (res.triggerRetryCount != null) attempt.put("triggerRetryCount", res.triggerRetryCount);
                errorSummary.append(provider).append(": ").append(res.error).append("; ");
            }
            attempts.add(attempt);
        }

        JSObject data = new JSObject();
        JSONArray arr = new JSONArray();
        for (JSObject a : attempts) {
            arr.put(a);
        }
        data.put("attempts", arr);
        call.reject("All providers failed: " + errorSummary.toString(), null, null, data);
    }

    private void resolveWithSuccess(
            PluginCall call, String url, String fileName, String provider, List<JSObject> attempts) {
        JSObject ret = new JSObject();
        ret.put("url", url);
        ret.put("fileName", fileName);
        ret.put("provider", provider);
        JSONArray arr = new JSONArray();
        for (JSObject a : attempts) {
            arr.put(a);
        }
        ret.put("attempts", arr);
        call.resolve(ret);
    }

    /** The file's name made safe for the cache and provider pages, read without copying the file into the cache. */
    private String getFileName(Uri uri) {
        try {
            return FileUtils.sanitizeFileName(FileUtils.getFileName(getContext(), uri));
        } catch (Exception e) {
            return "unknown";
        }
    }

    private MediaUploadResult uploadToCatboxSync(Uri fileUri) {
        JSObject statusUpdate = new JSObject();
        statusUpdate.put("status", "Uploading to catbox.moe...");
        notifyListeners("uploadStatus", statusUpdate);

        return CatboxUploader.upload(getContext(), fileUri, CATBOX_TIMEOUT_SEC, CATBOX_CALL_TIMEOUT_SEC);
    }

    private MediaUploadResult uploadViaWebViewSync(Uri fileUri, String provider) {
        JSObject statusUpdate = new JSObject();
        statusUpdate.put("status", "Uploading to " + provider + "...");
        notifyListeners("uploadStatus", statusUpdate);

        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<MediaUploadResult> resultRef = new AtomicReference<>();

        AppCompatActivity activity = getActivity();
        if (activity == null) {
            return new MediaUploadResult(false, null, "Activity unavailable");
        }

        String fileName = getFileName(fileUri);
        MediaUploadCallback callback =
                res -> {
                    resultRef.set(res);
                    latch.countDown();
                };

        activity.runOnUiThread(
                () -> {
                    MediaUploadAutomationRunner runner =
                            new MediaUploadAutomationRunner(
                                    getContext(),
                                    fileUri,
                                    fileName,
                                    provider,
                                    callback);
                    runner.run();
                });

        try {
            boolean ok =
                    latch.await(
                            MediaUploadRecipes.getUploadTimeoutMs(provider) + 5000,
                            TimeUnit.MILLISECONDS);
            if (!ok) {
                return new MediaUploadResult(false, null, "WebView upload timeout");
            }
            MediaUploadResult r = resultRef.get();
            return r != null ? r : new MediaUploadResult(false, null, "No result");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new MediaUploadResult(false, null, "Interrupted");
        }
    }

    private MediaUploadResult uploadGeneratedViaWebViewSync(
            byte[] fileBytes, String fileName, String mimeType, String provider) {
        JSObject statusUpdate = new JSObject();
        statusUpdate.put("status", "Uploading to " + provider + "...");
        notifyListeners("uploadStatus", statusUpdate);

        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<MediaUploadResult> resultRef = new AtomicReference<>();

        AppCompatActivity activity = getActivity();
        if (activity == null) {
            return new MediaUploadResult(false, null, "Activity unavailable");
        }

        MediaUploadCallback callback =
                res -> {
                    resultRef.set(res);
                    latch.countDown();
                };

        activity.runOnUiThread(
                () -> {
                    MediaUploadAutomationRunner runner =
                            new MediaUploadAutomationRunner(
                                    getContext(),
                                    fileBytes,
                                    fileName,
                                    mimeType,
                                    provider,
                                    callback,
                                    null);
                    runner.run();
                });

        try {
            boolean ok =
                    latch.await(
                            MediaUploadRecipes.getUploadTimeoutMs(provider) + 5000,
                            TimeUnit.MILLISECONDS);
            if (!ok) {
                return new MediaUploadResult(false, null, "WebView upload timeout");
            }
            MediaUploadResult r = resultRef.get();
            return r != null ? r : new MediaUploadResult(false, null, "No result");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new MediaUploadResult(false, null, "Interrupted");
        }
    }
}
