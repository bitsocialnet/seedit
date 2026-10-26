/**
 * Main-process automation for media upload via provider web UIs.
 * Uses a hidden BrowserWindow + CDP (DOM.setFileInputFiles) for non-interactive uploads.
 * Fail-fast on blocked indicators (captcha/login). No interactive fallback.
 *
 * Diagnostics (parity with Android): selector match/timeout info included in errors
 * for debugging. Poll interval 500ms, timeout per recipe matches Android where
 * providers overlap (imgur: 45s).
 */
import { BrowserWindow, session } from 'electron';
import { MEDIA_UPLOAD_RECIPES } from './media-upload-recipes.js';

/** In-memory session for provider pages, apart from the app's default session. */
const PARTITION = 'media-upload-automation';

/** Poll interval (ms) – parity with Android MediaUploadRecipes.POLL_INTERVAL_MS */
const POLL_INTERVAL_MS = 500;

/** File extensions that denote direct media URLs (mirrors src/lib/media-hosting/direct-url.ts) */
const DIRECT_MEDIA_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.webm', '.mp4', '.mov', '.avi', '.mkv', '.gifv', '.swf'];

let automationSession = null;

/**
 * Provider pages are untrusted remote code. The default session strips Origin and adds wildcard
 * CORS headers to every top-level XHR for the app's own window (electron/main.js), which would let
 * them read cross-origin responses, local services included, so they run in a session of their own.
 */
function getAutomationSession() {
  if (automationSession) return automationSession;
  const ses = session.fromPartition(PARTITION);
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  automationSession = ses;
  return ses;
}

/** Returns true if the URL appears to point to a direct media file. Exported for tests. */
export function isDirectMediaUrl(url) {
  try {
    const normalized = url.split('?')[0].split('#')[0].toLowerCase();
    return DIRECT_MEDIA_EXTENSIONS.some((ext) => normalized.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * Run automated upload for a provider.
 * @param {Object} options
 * @param {string} options.provider - Provider id (catbox, imgur, imgbb)
 * @param {string} options.filePath - Absolute path to the file to upload
 * @returns {Promise<{ url: string; provider: string }>}
 * @throws {Error} On missing recipe, blocked indicators, timeout, or invalid URL
 */
export async function automateUploadMedia(options) {
  const { provider, filePath } = options;
  const recipe = MEDIA_UPLOAD_RECIPES[provider];
  if (!recipe) {
    throw new Error(`No automation recipe for provider: ${provider}`);
  }

  let win = null;
  try {
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        session: getAutomationSession(),
        webSecurity: true,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    await new Promise((resolve, reject) => {
      try {
        win.webContents.debugger.attach('1.3');
        resolve();
      } catch (e) {
        reject(e);
      }
    });

    const sendCommand = (method, params = {}) => win.webContents.debugger.sendCommand(method, params);

    await sendCommand('DOM.enable');
    await sendCommand('Page.enable');

    const PAGE_LOAD_TIMEOUT_MS = 30_000;
    await new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn, arg) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        win.webContents.removeListener('did-finish-load', onLoad);
        win.webContents.removeListener('did-fail-load', onFail);
        fn(arg);
      };
      const onLoad = () => settle(resolve);
      // An ad, analytics or challenge iframe that fails to load does not fail the upload page.
      const onFail = (_, code, desc, _url, isMainFrame) => {
        if (isMainFrame) settle(reject, new Error(`Page load failed: ${code} ${desc}`));
      };
      const timer = setTimeout(() => settle(reject, new Error(`Page load timed out after ${PAGE_LOAD_TIMEOUT_MS}ms for ${recipe.uploadUrl}`)), PAGE_LOAD_TIMEOUT_MS);
      win.webContents.once('did-finish-load', onLoad);
      win.webContents.on('did-fail-load', onFail);
      win.loadURL(recipe.uploadUrl);
    });

    // Small delay for SPA/JS to settle
    await new Promise((r) => setTimeout(r, 1500));

    const doc = await sendCommand('DOM.getDocument');
    const rootNodeId = doc.root?.nodeId;
    if (rootNodeId == null) {
      throw new Error('Could not get document root');
    }

    const queryOne = async (selector) => {
      const { nodeId } = await sendCommand('DOM.querySelector', {
        nodeId: rootNodeId,
        selector,
      });
      return nodeId || null;
    };

    const checkBlocked = async () => {
      for (const sel of recipe.blockedIndicators) {
        const nodeId = await queryOne(sel);
        if (nodeId) return sel;
      }
      return null;
    };

    const blockedSel = await checkBlocked();
    if (blockedSel) {
      throw new Error(`Provider blocked: captcha, login, or challenge detected (${provider}), selector: ${blockedSel}`);
    }

    let fileInputNodeId = null;
    for (const sel of recipe.fileInputSelectorCandidates) {
      fileInputNodeId = await queryOne(sel);
      if (fileInputNodeId) break;
    }
    if (!fileInputNodeId) {
      throw new Error(`No file input found for ${provider}. Tried: ${recipe.fileInputSelectorCandidates.join(', ')}`);
    }

    await sendCommand('DOM.setFileInputFiles', {
      nodeId: fileInputNodeId,
      files: [filePath],
    });
    await new Promise((r) => setTimeout(r, 500));

    if (recipe.prepareSubmitJs) {
      await sendCommand('Runtime.evaluate', {
        expression: recipe.prepareSubmitJs,
        returnByValue: true,
      });
    }

    let submitNodeId = null;
    for (const sel of recipe.submitSelectorCandidates) {
      submitNodeId = await queryOne(sel);
      if (submitNodeId) break;
    }
    if (!submitNodeId) {
      throw new Error(`No submit button found for ${provider}. Tried: ${recipe.submitSelectorCandidates.join(', ')}`);
    }

    const clickNode = async (nodeId) => {
      const { model } = await sendCommand('DOM.getBoxModel', { nodeId });
      if (!model?.content || model.content.length < 8) {
        throw new Error('Cannot click node: box model unavailable (element may be hidden or zero-size)');
      }
      const content = model.content;
      const x = (content[0] + content[2] + content[4] + content[6]) / 4;
      const y = (content[1] + content[3] + content[5] + content[7]) / 4;
      await sendCommand('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x,
        y,
        button: 'left',
        clickCount: 1,
      });
      await sendCommand('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x,
        y,
        button: 'left',
        clickCount: 1,
      });
    };

    await sendCommand('Input.enable');
    await clickNode(submitNodeId);

    const extractUrl = async () => {
      const { selectorCandidates, attribute } = recipe.successExtractor;
      const attr = attribute;
      const code = `
        (function() {
          const selectors = ${JSON.stringify(selectorCandidates)};
          const attr = ${JSON.stringify(attr)};
          function normalizeUrl(value) {
            if (!value) return '';
            let url = String(value).trim();
            if (url.startsWith('//')) url = 'https:' + url;
            return url;
          }
          function hasMediaExtension(url) {
            return /\\.(?:jpe?g|png|gif|webp|bmp|avif|mp4|webm|mov|avi|mkv|gifv)(?:[?#].*)?$/i.test(url);
          }
          function pickDirectMediaUrl(value) {
            const text = String(value || '');
            const candidates = text.match(/https?:\\/\\/[^\\s"'<>\\[\\]]+/g) || [];
            for (const candidate of candidates) {
              const normalized = normalizeUrl(candidate);
              if (hasMediaExtension(normalized)) return normalized;
            }
            const normalized = normalizeUrl(text);
            if (normalized.startsWith('http') && hasMediaExtension(normalized)) return normalized;
            if (normalized.startsWith('http')) return normalized;
            return '';
          }
          function readValues(el) {
            const preferred = attr === 'text' ? el.textContent : attr === 'value' ? el.value || el.getAttribute('value') : el.getAttribute(attr) || el[attr];
            // A recipe's fallback selectors match different elements (an input, a link, an img), which
            // hold the URL in their own attribute rather than the recipe's.
            return [preferred, el.value, el.getAttribute('href'), el.getAttribute('src'), el.getAttribute('data-link'), el.textContent];
          }
          for (const sel of selectors) {
            try {
              const el = document.querySelector(sel);
              if (!el) continue;
              for (const value of readValues(el)) {
                const directUrl = pickDirectMediaUrl(String(value || '').trim());
                if (directUrl && hasMediaExtension(directUrl)) return directUrl;
              }
            } catch (e) {}
          }
          return null;
        })()
      `;
      const { result } = await sendCommand('Runtime.evaluate', {
        expression: code,
        returnByValue: true,
      });
      return result?.value ?? null;
    };

    const start = Date.now();
    let url = null;
    while (Date.now() - start < recipe.timeoutMs) {
      const blockedDuring = await checkBlocked();
      if (blockedDuring) {
        throw new Error(`Provider blocked during upload: captcha or challenge (${provider}), selector: ${blockedDuring}`);
      }
      url = await extractUrl();
      if (url && isDirectMediaUrl(url)) {
        break;
      }
      url = null;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    const elapsed = Date.now() - start;
    if (!url || !isDirectMediaUrl(url)) {
      throw new Error(`Upload timeout or no direct URL extracted for ${provider} (elapsed: ${elapsed}ms, timeout: ${recipe.timeoutMs}ms)`);
    }

    return { url, provider };
  } finally {
    if (win && !win.isDestroyed()) {
      try {
        if (win.webContents?.debugger?.isAttached?.()) {
          win.webContents.debugger.detach();
        }
      } catch {
        /* ignore */
      }
      win.destroy();
      win = null;
    }
  }
}
