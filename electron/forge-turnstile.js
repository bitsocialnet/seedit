/**
 * Gets a Cloudflare Turnstile token for Forge Images uploads. Turnstile only
 * issues tokens on hostnames its sitekey allows, and the packaged renderer
 * loads from file://, which has no hostname. So the widget runs in its own
 * window on http://localhost (an allowed hostname), a page this module serves
 * from a separate in-memory session where plain http never reaches the
 * network. The window stays hidden unless Cloudflare asks the user to
 * interact with the challenge.
 */
import { BrowserWindow, nativeTheme, session } from 'electron';

const PARTITION = 'forge-turnstile';
const PAGE_ORIGIN = 'http://localhost';
const PAGE_PATH = '/forge-turnstile';
const SITEKEY_PATTERN = /^[0-9A-Za-z_-]{1,100}$/;
/** Backstop for a page that never answers; the page's own timeouts normally settle first. */
const WINDOW_TIMEOUT_MS = 180_000;

// Timeouts mirror src/lib/utils/turnstile-utils.ts, which runs the same widget on web.
const PAGE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Forge Images</title>
<style>:root{color-scheme:light dark}html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center}</style>
</head>
<body>
<div id="widget"></div>
<script>
const SCRIPT_LOAD_TIMEOUT_MS = 15000;
const TOKEN_TIMEOUT_MS = 30000;
const INTERACTIVE_TOKEN_TIMEOUT_MS = 120000;
let markInteractive;
window.turnstileInteraction = new Promise((resolve) => { markInteractive = resolve; });
// Resolves with { token } or { error }: a rejected promise reaches the main process without its message.
window.turnstileResult = new Promise((resolve) => {
  let timeoutId = setTimeout(() => resolve({ error: 'Turnstile script load timed out' }), SCRIPT_LOAD_TIMEOUT_MS);
  const finish = (result) => { clearTimeout(timeoutId); resolve(result); };
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.onerror = () => finish({ error: 'Turnstile script failed to load' });
  script.onload = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => finish({ error: 'Turnstile check timed out' }), TOKEN_TIMEOUT_MS);
    try {
      window.turnstile.render('#widget', {
        sitekey: new URLSearchParams(location.search).get('sitekey'),
        appearance: 'interaction-only',
        retry: 'never',
        'refresh-expired': 'never',
        'response-field': false,
        callback: (token) => finish(token ? { token } : { error: 'Turnstile returned an empty token' }),
        'error-callback': (code) => { finish({ error: 'Turnstile error ' + code }); return true; },
        'expired-callback': () => finish({ error: 'Turnstile token expired' }),
        'timeout-callback': () => finish({ error: 'Turnstile challenge timed out' }),
        'unsupported-callback': () => finish({ error: 'Turnstile is not supported by this browser' }),
        'before-interactive-callback': () => {
          markInteractive();
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => finish({ error: 'Turnstile check timed out' }), INTERACTIVE_TOKEN_TIMEOUT_MS);
        },
      });
    } catch (error) {
      finish({ error: String((error && error.message) || error) });
    }
  };
  document.head.appendChild(script);
});
</script>
</body>
</html>`;

let turnstileSession = null;

function getTurnstileSession() {
  if (turnstileSession) return turnstileSession;
  // Keeps Electron's own user agent: the Chrome one the main window sends contradicts
  // this browser's client hints, and Turnstile fails such a widget with error 600010.
  const ses = session.fromPartition(PARTITION);
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  // Serve only the widget page; any other plain-http request fails, so the page cannot reach local services.
  ses.protocol.handle('http', (request) => {
    const url = new URL(request.url);
    if (url.origin === PAGE_ORIGIN && url.pathname === PAGE_PATH) {
      return new Response(PAGE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return new Response(null, { status: 404 });
  });
  turnstileSession = ses;
  return ses;
}

/**
 * Returns a fresh single-use Turnstile token for the sitekey.
 * @param {Object} options
 * @param {string} options.sitekey - Turnstile sitekey of the Forge Images widget
 * @param {import('electron').BrowserWindow | null} options.parent - Window the challenge belongs to
 * @returns {Promise<string>}
 */
export async function getForgeTurnstileToken({ sitekey, parent }) {
  if (typeof sitekey !== 'string' || !SITEKEY_PATTERN.test(sitekey)) {
    throw new Error('Invalid Turnstile sitekey');
  }

  const win = new BrowserWindow({
    parent: parent ?? undefined,
    show: false,
    width: 340,
    height: 120,
    center: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    title: 'Forge Images',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff',
    webPreferences: {
      session: getTurnstileSession(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // Keeps the Page Visibility API reporting "visible" while the window is hidden.
      backgroundThrottling: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  let abort;
  const aborted = new Promise((_, reject) => {
    abort = reject;
  });
  // Settles the race below when the user closes the window or the page dies; also keeps a late close from going unhandled.
  aborted.catch(() => {});
  win.on('closed', () => abort(new Error('Turnstile check was closed')));
  win.webContents.on('render-process-gone', () => abort(new Error('Turnstile check crashed')));
  win.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame) abort(new Error(`Turnstile page failed to load: ${code} ${description}`));
  });
  const timeoutId = setTimeout(() => abort(new Error('Turnstile check timed out')), WINDOW_TIMEOUT_MS);

  try {
    // Wait for dom-ready, and read through mainFrame: loadURL and webContents.executeJavaScript both
    // wait until the page stops loading, which includes Cloudflare's script and iframe, so a stalled
    // challenge host would hold them past the page's own timeouts.
    const domReady = new Promise((resolve) => win.webContents.once('dom-ready', resolve));
    // Rejects with ERR_ABORTED when the window closes mid-load; did-fail-load reports real failures.
    win.loadURL(`${PAGE_ORIGIN}${PAGE_PATH}?sitekey=${sitekey}`).catch(() => {});
    await Promise.race([domReady, aborted]);
    // A reload (context menu or Cmd/Ctrl+R) discards the page the reads below wait on, so they would never settle.
    win.webContents.on('did-start-navigation', (details) => {
      if (details.isMainFrame && !details.isSameDocument) abort(new Error('Turnstile check was reloaded'));
    });
    const frame = win.webContents.mainFrame;
    frame.executeJavaScript('window.turnstileInteraction').then(
      () => {
        if (!win.isDestroyed()) win.show();
      },
      () => {},
    );
    const result = await Promise.race([frame.executeJavaScript('window.turnstileResult'), aborted]);
    if (typeof result?.token === 'string' && result.token) return result.token;
    throw new Error(typeof result?.error === 'string' ? result.error : 'Turnstile returned no token');
  } finally {
    clearTimeout(timeoutId);
    if (!win.isDestroyed()) win.destroy();
  }
}
