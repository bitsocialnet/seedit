const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_LOAD_TIMEOUT_MS = 15_000;
/** Backstop for a widget that never answers; an invisible solve takes a few seconds. */
const TOKEN_TIMEOUT_MS = 30_000;
/** Once Cloudflare asks for interaction, give the user time to solve the challenge. */
const INTERACTIVE_TOKEN_TIMEOUT_MS = 120_000;

interface TurnstileRenderOptions {
  sitekey: string;
  appearance: 'always' | 'execute' | 'interaction-only';
  retry: 'auto' | 'never';
  'refresh-expired': 'auto' | 'manual' | 'never';
  'response-field': boolean;
  callback: (token: string) => void;
  'error-callback': (code: string) => boolean;
  'expired-callback': () => void;
  'timeout-callback': () => void;
  'unsupported-callback': () => void;
  'before-interactive-callback': () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | null | undefined;
  remove: (widgetId: string) => void;
}

const getTurnstileApi = (): TurnstileApi | undefined => (window as Window & { turnstile?: TurnstileApi }).turnstile;

let scriptPromise: Promise<TurnstileApi> | null = null;

/** Loads Cloudflare's Turnstile script once, on first use. A failed load is retried on the next call. */
function loadTurnstile(): Promise<TurnstileApi> {
  const loaded = getTurnstileApi();
  if (loaded) return Promise.resolve(loaded);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const settle = (error: Error | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      script.onload = null;
      script.onerror = null;
      const api = error ? undefined : getTurnstileApi();
      if (api) {
        resolve(api);
        return;
      }
      script.remove();
      reject(error ?? new Error('Turnstile script loaded without its API'));
    };
    const timeoutId = window.setTimeout(() => settle(new Error('Turnstile script load timed out')), SCRIPT_LOAD_TIMEOUT_MS);
    script.onload = () => settle(null);
    script.onerror = () => settle(new Error('Turnstile script failed to load'));
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

/**
 * Hosts the widget. It renders nothing visible while Turnstile solves invisibly;
 * when Cloudflare needs the user to interact, it becomes a flat, square,
 * theme-bordered box in the middle of the viewport so the challenge is usable.
 */
function createWidgetContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.setAttribute('data-turnstile-container', '');
  Object.assign(container.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: '1003',
  });
  return container;
}

function showWidgetContainer(container: HTMLDivElement) {
  container.setAttribute('data-interactive', '');
  Object.assign(container.style, {
    padding: '5px',
    // The challenge modal's frame (components/challenge-modal).
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border-text)',
  });
}

/**
 * Returns a fresh single-use Turnstile token. The widget is invisible unless
 * Cloudflare demands interaction, and is removed once the token (or an error)
 * arrives. Rejects on script load failure, widget error, expiry or timeout.
 */
export async function getTurnstileToken(sitekey: string): Promise<string> {
  const turnstile = await loadTurnstile();

  return new Promise<string>((resolve, reject) => {
    const container = createWidgetContainer();
    let widgetId: string | null | undefined;
    let settled = false;
    let timeoutId = window.setTimeout(() => finish(new Error('Turnstile check timed out')), TOKEN_TIMEOUT_MS);

    const removeWidget = () => {
      if (!widgetId) return;
      try {
        turnstile.remove(widgetId);
      } catch {
        // The widget may already be gone; the container removal below cleans up the DOM.
      }
    };

    function finish(error: Error | null, token?: string) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      removeWidget();
      container.remove();
      if (error) {
        reject(error);
      } else {
        resolve(token ?? '');
      }
    }

    document.body.appendChild(container);
    try {
      widgetId = turnstile.render(container, {
        sitekey,
        appearance: 'interaction-only',
        // Fail fast into the upload error path instead of retrying behind the user's back.
        retry: 'never',
        'refresh-expired': 'never',
        'response-field': false,
        callback: (token) => finish(token ? null : new Error('Turnstile returned an empty token'), token),
        'error-callback': (code) => {
          finish(new Error(`Turnstile error ${code}`));
          return true;
        },
        'expired-callback': () => finish(new Error('Turnstile token expired')),
        'timeout-callback': () => finish(new Error('Turnstile challenge timed out')),
        'unsupported-callback': () => finish(new Error('Turnstile is not supported by this browser')),
        'before-interactive-callback': () => {
          showWidgetContainer(container);
          window.clearTimeout(timeoutId);
          timeoutId = window.setTimeout(() => finish(new Error('Turnstile check timed out')), INTERACTIVE_TOKEN_TIMEOUT_MS);
        },
      });
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    if (settled) {
      // A callback fired synchronously during render, before widgetId was known.
      removeWidget();
    } else if (!widgetId) {
      finish(new Error('Turnstile widget failed to render'));
    }
  });
}
