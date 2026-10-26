package seedit.android;

import android.content.Context;
import android.net.Uri;
import android.util.Log;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

final class CatboxUploader {
    private static final String TAG = "CatboxUploader";
    private static final String CATBOX_API_URL = "https://catbox.moe/user/api.php";
    private static final String CATBOX_FILE_URL_PREFIX = "https://files.catbox.moe/";
    private static final String CATBOX_FILE_URL_PREFIX_HTTP = "http://files.catbox.moe/";
    private static final int MAX_UPLOAD_ATTEMPTS = 2;

    private CatboxUploader() {}

    /**
     * @param idleTimeoutSec longest stall while connecting, sending or reading
     * @param callTimeoutSec longest whole upload, long enough for a large video or PDF on a slow uplink
     */
    static MediaUploadResult upload(Context context, Uri fileUri, long idleTimeoutSec, long callTimeoutSec) {
        try {
            Log.d(TAG, "Resolving file for catbox upload");
            File file = FileUtils.getFileFromUri(context, fileUri);
            if (file == null) {
                return new MediaUploadResult(false, null, "Could not resolve file");
            }
            Log.d(TAG, "Resolved catbox upload file: " + file.getName() + " (" + file.length() + " bytes)");

            OkHttpClient client =
                    new OkHttpClient.Builder()
                            .callTimeout(callTimeoutSec, TimeUnit.SECONDS)
                            .connectTimeout(idleTimeoutSec, TimeUnit.SECONDS)
                            .writeTimeout(idleTimeoutSec, TimeUnit.SECONDS)
                            .readTimeout(idleTimeoutSec, TimeUnit.SECONDS)
                            .build();

            MediaUploadResult lastResult = null;
            for (int attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
                Request request = buildRequest(file);
                Log.d(TAG, "Starting catbox upload request attempt " + attempt);
                lastResult = executeRequest(client, request, callTimeoutSec);
                if (lastResult.success || !isRetryable(lastResult) || attempt == MAX_UPLOAD_ATTEMPTS) {
                    return lastResult;
                }
                Log.w(TAG, "Retrying catbox upload after: " + lastResult.error);
            }

            return lastResult != null ? lastResult : new MediaUploadResult(false, null, "No result");
        } catch (Exception e) {
            Log.e(TAG, "Catbox upload failed", e);
            return new MediaUploadResult(false, null, e.getMessage());
        }
    }

    private static Request buildRequest(File file) {
        RequestBody requestBody =
                new MultipartBody.Builder()
                        .setType(MultipartBody.FORM)
                        .addFormDataPart("reqtype", "fileupload")
                        .addFormDataPart(
                                "fileToUpload",
                                file.getName(),
                                RequestBody.create(
                                        file, MediaType.parse("application/octet-stream")))
                        .build();

        return new Request.Builder().url(CATBOX_API_URL).post(requestBody).build();
    }

    private static MediaUploadResult executeRequest(
            OkHttpClient client, Request request, long timeoutSec) throws InterruptedException {
        Call call = client.newCall(request);
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<MediaUploadResult> resultRef = new AtomicReference<>();
        call.enqueue(
                new Callback() {
                    @Override
                    public void onFailure(Call call, IOException e) {
                        resultRef.set(new MediaUploadResult(false, null, e.getMessage()));
                        latch.countDown();
                    }

                    @Override
                    public void onResponse(Call call, Response response) {
                        try {
                            resultRef.set(parseResponse(response));
                        } catch (Exception e) {
                            resultRef.set(new MediaUploadResult(false, null, e.getMessage()));
                        } finally {
                            response.close();
                            latch.countDown();
                        }
                    }
                });

        boolean completed = latch.await(timeoutSec, TimeUnit.SECONDS);
        if (!completed) {
            call.cancel();
            return new MediaUploadResult(false, null, "Upload timeout");
        }

        MediaUploadResult result = resultRef.get();
        return result != null ? result : new MediaUploadResult(false, null, "No result");
    }

    private static boolean isRetryable(MediaUploadResult result) {
        if (result == null || result.success || result.error == null) {
            return false;
        }
        return result.error.equals("Empty response body")
                || result.error.startsWith("Unexpected response body:")
                || result.error.equals("Upload timeout");
    }

    private static MediaUploadResult parseResponse(Response response) throws IOException {
        if (!response.isSuccessful()) {
            return new MediaUploadResult(false, null, "Unexpected response " + response.code());
        }
        if (response.body() == null) {
            return new MediaUploadResult(false, null, "Empty response body");
        }
        String trimmedUrl = response.body().string().trim();
        if (trimmedUrl.isEmpty()) {
            return new MediaUploadResult(false, null, "Empty response body");
        }
        if (!trimmedUrl.startsWith(CATBOX_FILE_URL_PREFIX)
                && !trimmedUrl.startsWith(CATBOX_FILE_URL_PREFIX_HTTP)) {
            return new MediaUploadResult(false, null, "Unexpected response body: " + trimmedUrl);
        }
        Log.d(TAG, "Catbox upload successful. URL: " + trimmedUrl);
        return new MediaUploadResult(true, trimmedUrl, null);
    }
}
