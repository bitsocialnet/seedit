/**
 * Provider-specific recipes for automated media upload via hidden BrowserWindow.
 * Each recipe defines selectors and behavior for DOM-based upload flows.
 * Selectors are candidate-based: try each until one matches. Fail fast on blocked indicators.
 *
 * Android vs Electron differences (documented to prevent drift):
 * - Android (MediaUploadRecipes.java): app uploads use native catbox, plus WebView
 *   automation for imgbb. The imgur runner is retained for diagnostics/tests only.
 *   Real Uri attempts use the WebView file chooser callback; fixtures/fallback use
 *   DataTransfer.
 * - Electron: catbox/imgur/imgbb. Uses CDP DOM.setFileInputFiles + submit button click.
 *   Catbox: Electron-only; keep behavior unchanged.
 * - Blocked/success selectors: reconciled with Android for imgbb and imgur.
 * - Timeouts: imgbb 60s; imgur 45s; catbox 30s (Electron-only).
 *
 * @typedef {Object} ProviderRecipe
 * @property {string} uploadUrl - Full URL of the provider's upload page
 * @property {readonly string[]} fileInputSelectorCandidates - CSS selectors for file input (first match wins)
 * @property {readonly string[]} submitSelectorCandidates - CSS selectors for submit/upload button
 * @property {Object} successExtractor - How to extract the result URL from the page
 * @property {readonly string[]} successExtractor.selectorCandidates - Selectors for element containing result URL
 * @property {'href'|'src'|'value'|'text'} successExtractor.attribute - Attribute or 'text' for textContent
 * @property {string=} prepareSubmitJs - Optional JS to normalize provider controls before clicking submit
 * @property {readonly string[]} blockedIndicators - Selectors that indicate captcha/login/challenge (fail immediately if present)
 * @property {number} timeoutMs - Max time to wait for upload completion
 */

/** @type {Readonly<Record<string, ProviderRecipe>>} */
export const MEDIA_UPLOAD_RECIPES = Object.freeze({
  catbox: Object.freeze({
    uploadUrl: 'https://catbox.moe',
    fileInputSelectorCandidates: Object.freeze(['input[type="file"]', 'input[type=file]']),
    submitSelectorCandidates: Object.freeze(['button[type="submit"]', 'input[type="submit"]', '[type="submit"]']),
    successExtractor: Object.freeze({
      selectorCandidates: Object.freeze(['a[href*="files.catbox.moe"]', 'input[value*="files.catbox.moe"]', '[class*="result"] a', 'textarea']),
      attribute: 'href',
    }),
    blockedIndicators: Object.freeze(['#challenge', '.captcha', '[data-captcha]', '.g-recaptcha', '.login-form', '#recaptcha']),
    timeoutMs: 30_000,
  }),
  /* Reconciled with Android MediaUploadRecipes (imgur): file input, success extractors, blocked indicators. */
  imgur: Object.freeze({
    uploadUrl: 'https://imgur.com/upload',
    fileInputSelectorCandidates: Object.freeze(['input[type="file"]', 'input[type=file]', '[data-file-input]']),
    submitSelectorCandidates: Object.freeze(['button[type="submit"]', '[data-action="upload"]', '.upload-btn', '[type="submit"]']),
    successExtractor: Object.freeze({
      selectorCandidates: Object.freeze(['a[href*="i.imgur.com"]', 'input[value*="i.imgur.com"]', '[class*="copy-link"] input', '[data-link]']),
      attribute: 'href',
    }),
    /* Android: .signin, .login. Electron adds: [data-captcha], .login-form for DOM variations. */
    blockedIndicators: Object.freeze(['#challenge', '.captcha', '[data-captcha]', '.g-recaptcha', '#recaptcha', '.login-form', '.signin', '.login']),
    timeoutMs: 45_000,
  }),
  imgbb: Object.freeze({
    uploadUrl: 'https://imgbb.com/',
    fileInputSelectorCandidates: Object.freeze(['input[type="file"]', '#anywhere-upload-input', 'input[data-action="anywhere-upload-input"]']),
    submitSelectorCandidates: Object.freeze(['button[data-action="upload"]', 'button.btn.green', 'button[type="submit"]', '[data-action="upload"]']),
    successExtractor: Object.freeze({
      selectorCandidates: Object.freeze([
        'input[name="html-embed-medium"]',
        'textarea[name="html-embed-medium"]',
        '#uploaded-embed-code-1',
        'input[value*="i.ibb.co"]',
        'textarea',
        'img[src*="i.ibb.co"]',
      ]),
      attribute: 'value',
    }),
    prepareSubmitJs:
      "(function(){var select=document.querySelector('#upload-expiration,select[name=\"upload-expiration\"]');if(select){select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));}return true;})()",
    blockedIndicators: Object.freeze(['#challenge', '.captcha', '[data-captcha]', '.g-recaptcha', '#recaptcha', '.login-form', '.signin', '.login']),
    timeoutMs: 60_000,
  }),
});

/**
 * Validates that every provider has required recipe fields: trigger (file input), success extractor,
 * blocked indicators, and timeout. Throws if any provider is invalid.
 */
function validateRecipes() {
  const required = ['fileInputSelectorCandidates', 'submitSelectorCandidates', 'successExtractor', 'blockedIndicators', 'timeoutMs'];
  for (const [provider, recipe] of Object.entries(MEDIA_UPLOAD_RECIPES)) {
    for (const key of required) {
      if (!(key in recipe) || recipe[key] == null) {
        throw new Error(`Recipe validation failed: ${provider} missing or null: ${key}`);
      }
    }
    const ex = recipe.successExtractor;
    if (!Array.isArray(ex?.selectorCandidates) || ex.selectorCandidates.length === 0 || !ex.attribute) {
      throw new Error(`Recipe validation failed: ${provider} successExtractor must have non-empty selectorCandidates and attribute`);
    }
    if (!Array.isArray(recipe.fileInputSelectorCandidates) || recipe.fileInputSelectorCandidates.length === 0) {
      throw new Error(`Recipe validation failed: ${provider} fileInputSelectorCandidates must be non-empty array`);
    }
    if (!Array.isArray(recipe.blockedIndicators) || recipe.blockedIndicators.length === 0) {
      throw new Error(`Recipe validation failed: ${provider} blockedIndicators must be non-empty array`);
    }
    if (!Array.isArray(recipe.submitSelectorCandidates) || recipe.submitSelectorCandidates.length === 0) {
      throw new Error(`Recipe validation failed: ${provider} submitSelectorCandidates must be non-empty array`);
    }
    if (typeof recipe.timeoutMs !== 'number' || recipe.timeoutMs <= 0) {
      throw new Error(`Recipe validation failed: ${provider} timeoutMs must be positive number`);
    }
  }
}

validateRecipes();

export { validateRecipes };
