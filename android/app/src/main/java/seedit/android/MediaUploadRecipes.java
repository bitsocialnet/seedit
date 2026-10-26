package seedit.android;

/**
 * Provider-specific recipes for automated media upload via WebView.
 * Reconciled with electron/media-upload-recipes.js for imgbb and imgur.
 *
 * Android vs Electron (prevent drift):
 * - Android app uploads use native catbox and WebView automation for imgur/imgbb. Real Uri
 *   attempts use the WebView file chooser callback when possible; fixtures/fallback use
 *   DataTransfer JS injection.
 * - Electron: catbox/imgur/imgbb. CDP DOM.setFileInputFiles + submit click.
 * - Selectors: file input, submit, success extractor, blocked indicators kept in sync for imgbb
 *   and imgur.
 */
public final class MediaUploadRecipes {

    public static final String PROVIDER_IMGUR = "imgur";
    public static final String PROVIDER_IMGBB = "imgbb";

    /** Max time to wait for upload completion (ms). */
    public static final long UPLOAD_TIMEOUT_MS = 45_000;
    public static final long IMGBB_UPLOAD_TIMEOUT_MS = 60_000;
    /** Max time to wait for provider file input to be found/triggered (ms). */
    public static final long FILE_INPUT_TIMEOUT_MS = 15_000;
    /** Poll interval for success/blocked checks (ms). */
    public static final long POLL_INTERVAL_MS = 500;
    /** Initial delay before first file-input trigger attempt (ms). SPAs may need settle time. */
    public static final long TRIGGER_INITIAL_DELAY_MS = 400;
    /** Delay between retry attempts when input not yet found (ms). */
    public static final long TRIGGER_RETRY_INTERVAL_MS = 400;

    private MediaUploadRecipes() {}

    public static boolean isWebViewProvider(String provider) {
        return PROVIDER_IMGUR.equals(provider) || PROVIDER_IMGBB.equals(provider);
    }

    public static boolean isAndroidUploadProvider(String provider) {
        return PROVIDER_IMGUR.equals(provider) || PROVIDER_IMGBB.equals(provider);
    }

    public static String getUploadUrl(String provider) {
        if (PROVIDER_IMGUR.equals(provider)) {
            return "https://imgur.com/upload";
        }
        if (PROVIDER_IMGBB.equals(provider)) {
            return "https://imgbb.com/";
        }
        return null;
    }

    /** Returns upload timeout. */
    public static long getUploadTimeoutMs(String provider) {
        if (PROVIDER_IMGBB.equals(provider)) {
            return IMGBB_UPLOAD_TIMEOUT_MS;
        }
        return UPLOAD_TIMEOUT_MS;
    }

    /**
     * JS to click submit/upload button after file is selected. Optional; some providers auto-upload.
     * Returns true if a submit button was found and clicked, false otherwise. Aligns with Electron.
     */
    public static String getSubmitClickJs(String provider) {
        if (PROVIDER_IMGUR.equals(provider)) {
            return buildSubmitClickJs(
                    new String[] {
                        "button[type=\"submit\"]",
                        "[data-action=\"upload\"]",
                        ".upload-btn",
                        "[type=\"submit\"]",
                    });
        }
        if (PROVIDER_IMGBB.equals(provider)) {
            return buildImgbbSubmitClickJs();
        }
        return null;
    }

    private static String buildImgbbSubmitClickJs() {
        return "(function(){"
                + "var select=document.querySelector('#upload-expiration,select[name=\"upload-expiration\"]');"
                + "if(select){select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));}"
                + "function visible(el){if(!el)return false;var r=el.getBoundingClientRect();var s=getComputedStyle(el);"
                + "return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&!el.disabled&&!(el.classList&&el.classList.contains('disabled'));}"
                + "var selectors=['button[data-action=\"upload\"]','button.btn.green','button[type=\"submit\"]','[data-action=\"upload\"]'];"
                + "for(var i=0;i<selectors.length;i++){var nodes=document.querySelectorAll(selectors[i]);"
                + "for(var j=0;j<nodes.length;j++){var n=nodes[j];var txt=((n.textContent||n.value||'')+'').toLowerCase();"
                + "if(visible(n)&&(txt.indexOf('upload')!==-1||n.getAttribute('data-action')==='upload')){n.click();return true;}}}"
                + "return false;})()";
    }

    private static String buildSubmitClickJs(String[] selectors) {
        StringBuilder sb = new StringBuilder("(function(){var s=[");
        for (int i = 0; i < selectors.length; i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(escapeJs(selectors[i])).append("\"");
        }
        sb.append(
                "];for(var i=0;i<s.length;i++){var el=document.querySelector(s[i]);if(el){el.click();return"
                        + " true;}}"
                        + "var fi=document.querySelector('input[type=\"file\"],input[type=file]');"
                        + "var hasFile=!!(fi&&fi.files&&fi.files.length>0&&fi.files[0]);"
                        + "if(fi&&fi.form&&hasFile){try{if(typeof fi.form.requestSubmit==='function'){fi.form.requestSubmit();}else{fi.form.submit();}return true;}catch(e){}}"
                        + "var nodes=document.querySelectorAll('button,input[type=\"submit\"],input[type=\"button\"],a,[role=\"button\"]');"
                        + "for(var j=0;j<nodes.length;j++){var n=nodes[j];if(!n)continue;"
                        + "var txt=((n.textContent||n.value||'')+'').toLowerCase();"
                        + "if((txt.indexOf('upload')!==-1||txt.indexOf('start')!==-1||txt.indexOf('send')!==-1)&&hasFile){try{n.click();return true;}catch(e){}}}"
                        + "return false;})()");
        return sb.toString();
    }

    /**
     * JS to inject file via DataTransfer into file input (no user activation required).
     * Decodes base64 to Uint8Array, builds File, sets input.files via DataTransfer,
     * dispatches change/input events. Returns matched selector (JSON string) if injection
     * succeeded, false otherwise.
     * Uses same selector candidates as getTriggerFileInputJs; only injects into actual
     * input[type=file] elements.
     */
    public static String getFileInjectionJs(String provider, String base64Data, String fileName, String mimeType) {
        if (PROVIDER_IMGUR.equals(provider)) {
            return buildFileInjectionJs(
                    new String[] {
                        "#file-input",
                        ".PopUpActions-fileInput",
                        "input[type=\"file\"]",
                        "input[type=file]",
                        "[data-file-input]",
                    },
                    false,
                    base64Data,
                    fileName,
                    mimeType);
        }
        if (PROVIDER_IMGBB.equals(provider)) {
            return buildFileInjectionJs(
                    new String[] {
                        "#anywhere-upload-input",
                        "input[data-action=\"anywhere-upload-input\"]",
                        "input[type=\"file\"]",
                        "input[type=file]",
                    },
                    false,
                    base64Data,
                    fileName,
                    mimeType);
        }
        return null;
    }

    private static String buildFileInjectionJs(
            String[] selectors, boolean strictInputOnly, String base64Data, String fileName, String mimeType) {
        String escapedBase64 = escapeJs(base64Data != null ? base64Data : "");
        String escapedFileName = escapeJs(fileName != null ? fileName : "file");
        String escapedMime = escapeJs(mimeType != null ? mimeType : "application/octet-stream");
        StringBuilder sb = new StringBuilder();
        sb.append("(function(){var s=[");
        for (int i = 0; i < selectors.length; i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(escapeJs(selectors[i])).append("\"");
        }
        String guard =
                strictInputOnly
                        ? "el&&(el.tagName==='INPUT'||el.tagName==='input')&&el.type==='file'"
                        : "el&&(el.tagName==='INPUT'||el.tagName==='input')&&el.type==='file'";
        sb.append("];for(var i=0;i<s.length;i++){var el=document.querySelector(s[i]);if(")
                .append(guard)
                .append("){try{var b=atob(\"")
                .append(escapedBase64)
                .append("\");var a=new Uint8Array(b.length);for(var j=0;j<b.length;j++)a[j]=b.charCodeAt(j);var f=new File([a],\"")
                .append(escapedFileName)
                .append("\",{type:\"")
                .append(escapedMime)
                .append("\"});var dt=new DataTransfer();dt.items.add(f);var assigned=false;try{el.files=dt.files;assigned=true;}catch(e){}if(!assigned){try{Object.defineProperty(el,'files',{configurable:true,value:dt.files});assigned=true;}catch(e){}}if(!assigned){return false;}el.dispatchEvent(new Event('change',{bubbles:true}));el.dispatchEvent(new Event('input',{bubbles:true}));return JSON.stringify(s[i]);}catch(e){return false;}}}return false;})()");
        return sb.toString();
    }

    /**
     * JS to trigger file input click so WebChromeClient.onShowFileChooser fires.
     * Uses candidate selectors; first match wins. Returns matched selector or false.
     */
    public static String getTriggerFileInputJs(String provider) {
        if (PROVIDER_IMGUR.equals(provider)) {
            return buildTriggerFileInputJs(
                    new String[] {
                        "#file-input",
                        ".PopUpActions-fileInput",
                        "input[type=\"file\"]",
                        "input[type=file]",
                        "[data-file-input]",
                    },
                    false);
        }
        if (PROVIDER_IMGBB.equals(provider)) {
            return buildTriggerFileInputJs(
                    new String[] {
                        ".btn.btn-big.blue",
                        "[data-action=\"top-bar-upload\"]",
                        "#anywhere-upload-input",
                        "input[data-action=\"anywhere-upload-input\"]",
                        "input[type=\"file\"]",
                        "input[type=file]",
                    },
                    false);
        }
        return null;
    }

    /** Returns matched selector string when found, false otherwise. */
    private static String buildTriggerFileInputJs(String[] selectors, boolean strictInputOnly) {
        StringBuilder sb = new StringBuilder("(function(){var s=[");
        for (int i = 0; i < selectors.length; i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(escapeJs(selectors[i])).append("\"");
        }
        String guard =
                strictInputOnly
                        ? "el&&(el.tagName==='INPUT'||el.tagName==='input')&&el.type==='file'"
                        : "el";
        sb.append(
                "];for(var i=0;i<s.length;i++){var el=document.querySelector(s[i]);if("
                        + guard
                        + "){el.click();return"
                        + " JSON.stringify(s[i]);}}return false;})()");
        return sb.toString();
    }

    /**
     * JS to extract direct media URL from page. Returns URL string or null.
     */
    public static String getSuccessJs(String provider) {
        String[] selectorCandidates;
        if (PROVIDER_IMGUR.equals(provider)) {
            selectorCandidates =
                    new String[] {
                        "a[href*=\"i.imgur.com\"]",
                        "input[value*=\"i.imgur.com\"]",
                        "meta[property=\"og:image\"][content*=\"i.imgur.com\"]",
                        "meta[name=\"twitter:image\"][content*=\"i.imgur.com\"]",
                        "meta[property=\"twitter:image\"][content*=\"i.imgur.com\"]",
                        "img[src*=\"i.imgur.com\"]",
                        "video source[src*=\"i.imgur.com\"]",
                        "video[src*=\"i.imgur.com\"]",
                    };
            return buildDirectHostSuccessJs(selectorCandidates, "i.imgur.com");
        } else if (PROVIDER_IMGBB.equals(provider)) {
            selectorCandidates =
                    new String[] {
                        "input[name=\"html-embed-medium\"]",
                        "textarea[name=\"html-embed-medium\"]",
                        "#uploaded-embed-code-1",
                        "input[value*=\"i.ibb.co\"]",
                        "textarea",
                        "img[src*=\"i.ibb.co\"]",
                    };
            return buildDirectHostSuccessJs(selectorCandidates, "i.ibb.co");
        }
        return null;
    }

    private static String buildDirectHostSuccessJs(String[] selectors, String directHost) {
        String escapedDirectHost = escapeJs(directHost);
        StringBuilder sb = new StringBuilder("(function(){var s=[");
        for (int i = 0; i < selectors.length; i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(escapeJs(selectors[i])).append("\"");
        }
        sb.append(
                "];"
                        + "function norm(v){if(!v)return null;v=String(v).trim();if(!v)return null;"
                        + "if(v.indexOf('//')===0)v='https:'+v;if(v.indexOf('http')!==0)return null;return v;}"
                        + "function hasMediaExt(u){return /\\.(?:jpe?g|png|gif|webp|bmp|avif|mp4|webm)(?:[?#].*)?$/i.test(u);}"
                        + "function isDirectHost(u){try{var p=new URL(u,location.href);return p.hostname==='"
                        + escapedDirectHost
                        + "';}catch(e){return false;}}"
                        + "function pick(v){var u=norm(v);if(!u)return null;if(isDirectHost(u)&&hasMediaExt(u))return u;return null;}"
                        + "function pickFromText(v){var t=String(v||'');var m=t.match(/https?:\\/\\/[^\\s\"'<>\\[\\]]+/g)||[];"
                        + "for(var k=0;k<m.length;k++){var r=pick(m[k]);if(r)return r;}return pick(t);}"
                        + "for(var i=0;i<s.length;i++){try{var el=document.querySelector(s[i]);if(!el)continue;"
                        + "var c=[el.value,el.getAttribute('value'),el.getAttribute('href'),el.href,el.getAttribute('content'),el.getAttribute('src'),el.src,el.getAttribute('data-src'),el.getAttribute('data-link'),el.getAttribute('data-clipboard-text'),el.textContent];"
                        + "for(var j=0;j<c.length;j++){var r=pickFromText(c[j]);if(r)return r;}"
                        + "}catch(e){}}"
                        + "var og=document.querySelector('meta[property=\"og:image\"],meta[name=\"og:image\"],meta[name=\"twitter:image\"],meta[property=\"twitter:image\"]');"
                        + "if(og){var ro=pickFromText(og.getAttribute('content'));if(ro)return ro;}"
                        + "var media=document.querySelector('img[src*=\""
                        + escapedDirectHost
                        + "\"],video source[src*=\""
                        + escapedDirectHost
                        + "\"],video[src*=\""
                        + escapedDirectHost
                        + "\"]');"
                        + "if(media){var rm=pickFromText(media.getAttribute('src')||media.src);if(rm)return rm;}"
                        + "return null;})()");
        return sb.toString();
    }

    private static String buildSuccessJs(String[] selectors) {
        StringBuilder sb = new StringBuilder("(function(){var s=[");
        for (int i = 0; i < selectors.length; i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(escapeJs(selectors[i])).append("\"");
        }
        sb.append(
                "];for(var i=0;i<s.length;i++){try{var el=document.querySelector(s[i]);if(!el)continue;var v=(el.value||el.getAttribute(\"value\")||\"\").trim();var h=(el.getAttribute(\"href\")||el.href||\"\").trim();var t=(el.textContent||\"\").trim();var c=(el.getAttribute(\"content\")||\"\").trim();var src=(el.getAttribute(\"src\")||el.src||\"\").trim();if(h&&h.indexOf(\"http\")===0)return h;if(v&&v.indexOf(\"http\")===0)return v;if(c&&c.indexOf(\"http\")===0)return c;if(src&&src.indexOf(\"http\")===0)return src;if(t&&t.indexOf(\"http\")===0)return t}catch(e){}}return null})()");
        return sb.toString();
    }

    /**
     * JS to detect blocked state (captcha/login/challenge). Returns true if blocked.
     */
    public static String getBlockedJs(String provider) {
        if (PROVIDER_IMGUR.equals(provider)) {
            return buildBlockedJs(
                    new String[] {
                        "#challenge",
                        ".captcha",
                        "[data-captcha]",
                        ".g-recaptcha",
                        "#recaptcha",
                        ".login-form",
                        ".signin",
                        ".login",
                    });
        }
        if (PROVIDER_IMGBB.equals(provider)) {
            return buildBlockedJs(
                    new String[] {
                        "#challenge",
                        ".captcha",
                        "[data-captcha]",
                        ".g-recaptcha",
                        "#recaptcha",
                        ".login-form",
                        ".signin",
                        ".login",
                    });
        }
        return null;
    }

    /**
     * JS to detect visible provider-side upload failures that are not CAPTCHA/login blocks.
     * Returns an error string when a known provider failure is present, null otherwise.
     */
    public static String getProviderErrorJs(String provider) {
        if (PROVIDER_IMGUR.equals(provider)) {
            return "(function(){"
                    + "var text=((document.body&&document.body.innerText)||'');"
                    + "if(text.indexOf('CREATE_ALBUM_FAIL')!==-1)return 'CREATE_ALBUM_FAIL';"
                    + "if(text.indexOf('Something went wrong')!==-1)return 'Something went wrong';"
                    + "return null;})()";
        }
        return null;
    }

    private static String buildBlockedJs(String[] selectors) {
        StringBuilder sb = new StringBuilder("(function(){var s=[");
        for (int i = 0; i < selectors.length; i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(escapeJs(selectors[i])).append("\"");
        }
        sb.append("];for(var i=0;i<s.length;i++){if(document.querySelector(s[i]))return true}return false})()");
        return sb.toString();
    }

    private static String escapeJs(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
