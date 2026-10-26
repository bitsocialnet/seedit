package seedit.android;

import android.annotation.SuppressLint;
import android.content.ContentResolver;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/** Result of a WebView-based upload attempt. */
final class MediaUploadResult {
    public final boolean success;
    public final String url;
    public final String error;
    /** Stage reached before failure (e.g. "selector_matched", "chooser_triggered"). null if success. */
    public final String stage;
    /** Elapsed ms at completion. */
    public final long elapsedMs;
    /** Selector(s) that matched (for diagnostics). May be null. */
    public final String matchedSelectors;
    /** Number of trigger attempts before success or timeout (for diagnostics). null if not applicable. */
    public final Integer triggerRetryCount;

    public MediaUploadResult(boolean success, String url, String error) {
        this(success, url, error, null, 0, null, null);
    }

    public MediaUploadResult(
            boolean success, String url, String error, String stage, long elapsedMs, String matchedSelectors) {
        this(success, url, error, stage, elapsedMs, matchedSelectors, null);
    }

    public MediaUploadResult(
            boolean success,
            String url,
            String error,
            String stage,
            long elapsedMs,
            String matchedSelectors,
            Integer triggerRetryCount) {
        this.success = success;
        this.url = url;
        this.error = error;
        this.stage = stage;
        this.elapsedMs = elapsedMs;
        this.matchedSelectors = matchedSelectors;
        this.triggerRetryCount = triggerRetryCount;
    }
}

/** Callback for MediaUploadAutomationRunner. */
interface MediaUploadCallback {
    void onComplete(MediaUploadResult result);
}

/**
 * Non-interactive WebView automation for provider uploads.
 * Android uploads use the WebView file chooser when providers support it. ImgBB and fixture
 * tests use DataTransfer byte injection, then poll for success/blocked.
 */
@SuppressLint("SetJavaScriptEnabled")
public class MediaUploadAutomationRunner {
    private static final String TAG = "MediaUploadAutomation";

    /** Stage identifiers for diagnostics (aligned with user-visible error semantics). */
    static final String STAGE_PAGE_LOADED = "page_loaded";
    static final String STAGE_SELECTOR_MATCHED = "selector_matched";
    static final String STAGE_FILE_INJECTED = "file_injected";
    static final String STAGE_FILE_CHOOSER_CALLBACK = "file_chooser_callback";
    static final String STAGE_SUBMIT_CLICKED = "submit_clicked";
    static final String STAGE_SUCCESS_SELECTOR_MATCHED = "success_selector_matched";
    static final String STAGE_BLOCKED_DETECTED = "blocked_detected";
    static final String STAGE_PROVIDER_ERROR = "provider_error";
    static final String STAGE_INPUT_NOT_FOUND = "input_not_found";
    static final String STAGE_CHOOSER_NOT_TRIGGERED = "chooser_not_triggered";
    static final String STAGE_FILE_PAYLOAD_UNAVAILABLE = "file_payload_unavailable";
    static final String STAGE_UPLOAD_TIMED_OUT = "upload_timed_out";

    private final Context context;
    private final Uri fileUri;
    private final String fileName;
    private byte[] fileBytes;
    private String mimeType;
    private final String provider;
    private final MediaUploadCallback callback;
    /** When non-null (test fixtures), use instead of getUploadUrl(provider). */
    private final String overrideUploadUrl;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private final Handler mainHandler;
    private final Runnable pollRunnable;
    private final Runnable overallTimeoutRunnable;
    private boolean finished;
    private boolean fileInjected;
    private boolean dataTransferFallbackAttempted;
    private boolean submitClicked;
    private long startTime;
    /** Last matched selector (for diagnostics). */
    private String lastMatchedSelector;
    /** Number of trigger or injection attempts so far (for diagnostics). */
    private int triggerAttemptCount;

    private static final class ResolvedFilePayload {
        private final byte[] fileBytes;
        private final String mimeType;

        private ResolvedFilePayload(byte[] fileBytes, String mimeType) {
            this.fileBytes = fileBytes;
            this.mimeType = mimeType;
        }
    }

    private static ResolvedFilePayload resolveFilePayload(Context context, Uri uri) {
        if (context == null || uri == null) {
            return new ResolvedFilePayload(null, "application/octet-stream");
        }
        ContentResolver resolver = context.getContentResolver();
        String resolvedMime = resolver.getType(uri);
        String safeMime =
                (resolvedMime == null || resolvedMime.isEmpty())
                        ? "application/octet-stream"
                        : resolvedMime;
        try (InputStream input = resolver.openInputStream(uri);
                ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) {
                return new ResolvedFilePayload(null, safeMime);
            }
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            byte[] bytes = output.toByteArray();
            return new ResolvedFilePayload(bytes.length > 0 ? bytes : null, safeMime);
        } catch (Exception e) {
            Log.w(TAG, "Failed to resolve bytes from URI for DataTransfer injection", e);
            return new ResolvedFilePayload(null, safeMime);
        }
    }

    /**
     * Primary constructor: file bytes + MIME for DataTransfer injection (no user activation).
     * Package-visible for instrumentation tests (overrideUploadUrl).
     */
    MediaUploadAutomationRunner(
            Context context,
            byte[] fileBytes,
            String fileName,
            String mimeType,
            String provider,
            MediaUploadCallback callback,
            String overrideUploadUrl) {
        this.context = context.getApplicationContext();
        this.fileUri = null;
        this.fileName = fileName != null ? fileName : "file";
        this.fileBytes = fileBytes;
        this.mimeType = mimeType != null ? mimeType : "application/octet-stream";
        this.provider = provider;
        this.callback = callback;
        this.overrideUploadUrl = overrideUploadUrl;
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.pollRunnable = this::pollForResult;
        this.overallTimeoutRunnable = this::handleOverallTimeout;
    }

    /** Real Android upload constructor: prefer native WebView file chooser with this Uri. */
    public MediaUploadAutomationRunner(
            Context context, Uri fileUri, String fileName, String provider, MediaUploadCallback callback) {
        this(context, fileUri, fileName, provider, callback, null);
    }

    /**
     * Uri constructor with optional fixture URL.
     * Package-visible for instrumentation tests, though fixture tests usually use the bytes constructor.
     */
    MediaUploadAutomationRunner(
            Context context,
            Uri fileUri,
            String fileName,
            String provider,
            MediaUploadCallback callback,
            String overrideUploadUrl) {
        this.context = context.getApplicationContext();
        this.fileUri = fileUri;
        this.fileName = fileName != null ? fileName : "file";
        this.fileBytes = null;
        ContentResolver resolver = this.context.getContentResolver();
        String resolvedMime = fileUri != null ? resolver.getType(fileUri) : null;
        this.mimeType =
                (resolvedMime == null || resolvedMime.isEmpty())
                        ? "application/octet-stream"
                        : resolvedMime;
        this.provider = provider;
        this.callback = callback;
        this.overrideUploadUrl = overrideUploadUrl;
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.pollRunnable = this::pollForResult;
        this.overallTimeoutRunnable = this::handleOverallTimeout;
    }

    public void run() {
        mainHandler.post(this::startWebView);
    }

    private long elapsedMs() {
        return startTime > 0 ? System.currentTimeMillis() - startTime : 0;
    }

    private void logStage(String stage) {
        Log.d(TAG, "[" + provider + "] " + stage + " elapsed=" + elapsedMs() + "ms");
    }

    private boolean shouldUseFileChooser() {
        return fileUri != null
                && overrideUploadUrl == null
                && !MediaUploadRecipes.PROVIDER_IMGBB.equals(provider);
    }

    private boolean ensureFilePayload() {
        if (fileBytes != null && fileBytes.length > 0) {
            return true;
        }
        if (fileUri == null) {
            return false;
        }
        ResolvedFilePayload payload = resolveFilePayload(context, fileUri);
        fileBytes = payload.fileBytes;
        mimeType = payload.mimeType;
        return fileBytes != null && fileBytes.length > 0;
    }

    private void handleOverallTimeout() {
        if (finished) return;
        finish(
                new MediaUploadResult(
                        false,
                        null,
                        "Upload timeout",
                        STAGE_UPLOAD_TIMED_OUT,
                        elapsedMs(),
                        lastMatchedSelector,
                        triggerAttemptCount));
    }

    private void startWebView() {
        webView = new WebView(context);
        webView.setVisibility(android.view.View.GONE);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setUserAgentString(
                "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36");
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebChromeClient(
                new WebChromeClient() {
                    @Override
                    public boolean onShowFileChooser(
                            WebView webView,
                            ValueCallback<Uri[]> filePathCallback,
                            FileChooserParams fileChooserParams) {
                        if (!shouldUseFileChooser()) {
                            return false;
                        }
                        logStage(STAGE_FILE_CHOOSER_CALLBACK);
                        MediaUploadAutomationRunner.this.filePathCallback = filePathCallback;
                        fileInjected = true;
                        schedulePoll();
                        if (fileUri != null) {
                            filePathCallback.onReceiveValue(new Uri[] {fileUri});
                            MediaUploadAutomationRunner.this.filePathCallback = null;
                        }
                        return true;
                    }
                });

        webView.setWebViewClient(
                new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        logStage(STAGE_PAGE_LOADED);
                        if (shouldUseFileChooser()) {
                            mainHandler.postDelayed(
                                    MediaUploadAutomationRunner.this::triggerFileInput,
                                    MediaUploadRecipes.TRIGGER_INITIAL_DELAY_MS);
                            return;
                        }
                        if (!ensureFilePayload()) {
                            finish(
                                    new MediaUploadResult(
                                            false,
                                            null,
                                            "File payload unavailable for DataTransfer injection",
                                            STAGE_FILE_PAYLOAD_UNAVAILABLE,
                                            elapsedMs(),
                                            null));
                            return;
                        }
                        mainHandler.postDelayed(
                                MediaUploadAutomationRunner.this::injectFileViaDataTransfer,
                                MediaUploadRecipes.TRIGGER_INITIAL_DELAY_MS);
                    }
                });

        String uploadUrl =
                overrideUploadUrl != null ? overrideUploadUrl : MediaUploadRecipes.getUploadUrl(provider);
        if (uploadUrl == null) {
            finish(
                    new MediaUploadResult(
                            false, null, "Unknown provider: " + provider, "no_recipe", elapsedMs(), null));
            return;
        }
        startTime = System.currentTimeMillis();
        webView.loadUrl(uploadUrl);
        mainHandler.postDelayed(overallTimeoutRunnable, MediaUploadRecipes.getUploadTimeoutMs(provider));
        Log.d(TAG, "Loaded " + uploadUrl + " for provider " + provider);
    }

    private void triggerFileInput() {
        if (finished || fileInjected) return;
        String js = MediaUploadRecipes.getTriggerFileInputJs(provider);
        if (js == null) {
            finish(
                    new MediaUploadResult(
                            false, null, "No trigger JS for " + provider, "no_recipe", elapsedMs(), null));
            return;
        }
        triggerAttemptCount++;
        webView.evaluateJavascript(
                js,
                value -> {
                    if (finished || fileInjected) return;
                    String raw = value == null ? "" : value.trim();
                    String unquoted =
                            raw.replaceAll("^\"|\"$", "")
                                    .replace("\\u003d", "=")
                                    .replace("\\\"", "\"")
                                    .trim();
                    boolean matched = !"false".equals(raw) && unquoted.length() > 0;
                    if (matched) {
                        lastMatchedSelector = unquoted;
                        logStage(STAGE_SELECTOR_MATCHED);
                    }
                    scheduleTriggerRetry();
                });
    }

    private void scheduleTriggerRetry() {
        if (finished || fileInjected) return;
        long elapsed = elapsedMs();
        if (elapsed >= MediaUploadRecipes.FILE_INPUT_TIMEOUT_MS) {
            if (lastMatchedSelector != null && !dataTransferFallbackAttempted) {
                dataTransferFallbackAttempted = true;
                injectFileViaDataTransfer();
                return;
            }
            String stage = lastMatchedSelector != null ? STAGE_CHOOSER_NOT_TRIGGERED : STAGE_INPUT_NOT_FOUND;
            String error =
                    lastMatchedSelector != null
                            ? "File chooser not triggered"
                            : "File input not found";
            finish(
                    new MediaUploadResult(
                            false,
                            null,
                            error,
                            stage,
                            elapsed,
                            lastMatchedSelector,
                            triggerAttemptCount));
            return;
        }
        mainHandler.postDelayed(this::triggerFileInput, MediaUploadRecipes.TRIGGER_RETRY_INTERVAL_MS);
    }

    private void injectFileViaDataTransfer() {
        if (finished || fileInjected) return;
        if (!ensureFilePayload()) {
            finish(
                    new MediaUploadResult(
                            false,
                            null,
                            "File payload unavailable for DataTransfer injection",
                            STAGE_FILE_PAYLOAD_UNAVAILABLE,
                            elapsedMs(),
                            null));
            return;
        }
        String base64 = Base64.encodeToString(fileBytes, Base64.NO_WRAP);
        String js = MediaUploadRecipes.getFileInjectionJs(provider, base64, fileName, mimeType);
        if (js == null) {
            finish(
                    new MediaUploadResult(
                            false, null, "No injection JS for " + provider, "no_recipe", elapsedMs(), null));
            return;
        }
        triggerAttemptCount++;
        webView.evaluateJavascript(
                js,
                value -> {
                    if (finished) return;
                    String raw = value == null ? "" : value.trim();
                    String unquoted =
                            raw.replaceAll("^\"|\"$", "")
                                    .replace("\\u003d", "=")
                                    .replace("\\\"", "\"")
                                    .trim();
                    boolean matched = !"false".equals(raw) && unquoted.length() > 0;
                    if (matched) {
                        lastMatchedSelector = unquoted;
                        logStage(STAGE_SELECTOR_MATCHED);
                        fileInjected = true;
                        logStage(STAGE_FILE_INJECTED);
                        schedulePoll();
                        return;
                    }
                    scheduleInjectRetry();
                });
    }

    private void scheduleInjectRetry() {
        if (finished || fileInjected) return;
        long elapsed = elapsedMs();
        if (elapsed >= MediaUploadRecipes.FILE_INPUT_TIMEOUT_MS) {
            finish(
                    new MediaUploadResult(
                            false,
                            null,
                            "File input not found",
                            STAGE_INPUT_NOT_FOUND,
                            elapsed,
                            null,
                            triggerAttemptCount));
            return;
        }
        mainHandler.postDelayed(this::injectFileViaDataTransfer, MediaUploadRecipes.TRIGGER_RETRY_INTERVAL_MS);
    }

    private void schedulePoll() {
        mainHandler.removeCallbacks(pollRunnable);
        mainHandler.postDelayed(pollRunnable, MediaUploadRecipes.POLL_INTERVAL_MS);
    }

    private void pollForResult() {
        if (finished) return;

        long elapsed = elapsedMs();
        if (elapsed >= MediaUploadRecipes.getUploadTimeoutMs(provider)) {
            finish(
                    new MediaUploadResult(
                            false,
                            null,
                            "Upload timeout",
                            STAGE_UPLOAD_TIMED_OUT,
                            elapsed,
                            lastMatchedSelector));
            return;
        }

        // Optional submit step after file selection/injection: some providers need explicit submit.
        // Retry submit attempts until one actually clicks; some pages render/enable controls late.
        if (fileInjected && !submitClicked) {
            String submitJs = MediaUploadRecipes.getSubmitClickJs(provider);
            if (submitJs != null) {
                webView.evaluateJavascript(
                        submitJs,
                        clicked -> {
                            if (finished) return;
                            if ("true".equals(clicked != null ? clicked.trim() : "")) {
                                submitClicked = true;
                                logStage(STAGE_SUBMIT_CLICKED);
                            }
                        });
            } else {
                // No submit recipe for this provider; rely on passive success polling.
                submitClicked = true;
            }
            // Even when submit isn't confirmed, continue success polling:
            // some providers auto-upload on input change and never expose a clickable submit.
        }

        String successJs = MediaUploadRecipes.getSuccessJs(provider);
        String blockedJs = MediaUploadRecipes.getBlockedJs(provider);
        String providerErrorJs = MediaUploadRecipes.getProviderErrorJs(provider);
        if (successJs == null || blockedJs == null) {
            finish(
                    new MediaUploadResult(
                            false, null, "Missing recipe for " + provider, "no_recipe", elapsed, null));
            return;
        }

        webView.evaluateJavascript(
                blockedJs,
                blocked -> {
                    if (finished) return;
                    if ("true".equals(blocked)) {
                        logStage(STAGE_BLOCKED_DETECTED);
                        finish(
                                new MediaUploadResult(
                                        false,
                                        null,
                                        "Provider blocked (CAPTCHA/rate limit)",
                                        STAGE_BLOCKED_DETECTED,
                                        elapsedMs(),
                                        null));
                        return;
                    }
                    if (providerErrorJs != null) {
                        webView.evaluateJavascript(
                                providerErrorJs,
                                providerError -> {
                                    if (finished) return;
                                    String cleaned =
                                            providerError == null
                                                    ? ""
                                                    : providerError
                                                            .replaceAll("^\"|\"$", "")
                                                            .replace("\\u003d", "=")
                                                            .replace("\\\"", "\"")
                                                            .trim();
                                    if (!cleaned.isEmpty() && !"null".equals(cleaned)) {
                                        finish(
                                                new MediaUploadResult(
                                                        false,
                                                        null,
                                                        "Provider error: " + cleaned,
                                                        STAGE_PROVIDER_ERROR,
                                                        elapsedMs(),
                                                        lastMatchedSelector));
                                        return;
                                    }
                                    evaluateSuccess(successJs);
                                });
                        return;
                    }
                    evaluateSuccess(successJs);
                });
    }

    private void evaluateSuccess(String successJs) {
        webView.evaluateJavascript(
                successJs,
                url -> {
                    if (finished) return;
                    if (url != null && !"null".equals(url) && url.length() > 2) {
                        String cleaned =
                                url.replaceAll("^\"|\"$", "").replace("\\u003d", "=");
                        if (cleaned.startsWith("http")) {
                            logStage(STAGE_SUCCESS_SELECTOR_MATCHED);
                            finish(new MediaUploadResult(true, cleaned, null));
                            return;
                        }
                    }
                    schedulePoll();
                });
    }

    private void finish(MediaUploadResult result) {
        if (finished) return;
        finished = true;
        mainHandler.removeCallbacks(pollRunnable);
        mainHandler.removeCallbacks(overallTimeoutRunnable);
        if (filePathCallback != null) {
            try {
                filePathCallback.onReceiveValue(null);
            } catch (Exception ignored) {}
            filePathCallback = null;
        }
        tearDown();
        callback.onComplete(result);
    }

    private void tearDown() {
        Runnable cleanup =
                () -> {
                    if (webView == null) {
                        return;
                    }
                    try {
                        webView.stopLoading();
                        webView.clearHistory();
                        webView.clearCache(true);
                        webView.clearSslPreferences();
                        webView.destroy();
                    } catch (Exception e) {
                        Log.w(TAG, "Teardown warning", e);
                    }
                    webView = null;
                };
        if (Looper.myLooper() == Looper.getMainLooper()) {
            cleanup.run();
            return;
        }
        mainHandler.post(cleanup);
    }
}
