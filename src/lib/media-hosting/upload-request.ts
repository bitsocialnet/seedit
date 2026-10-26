/** The parts of a fetch Response that uploaders read. */
interface UploadResponse {
  ok: boolean;
  status: number;
  statusText: string;
  /** Parses the body as JSON; rejects when it is not JSON. */
  json: () => Promise<unknown>;
}

interface PostFormDataOptions {
  signal?: AbortSignal;
  /** Called once the whole request body has been sent, while the server is still working on it. */
  onBodySent?: () => void;
}

/** The WebView's own XMLHttpRequest, which Capacitor saves before CapacitorHttp patches it. */
interface CapacitorWebXhr {
  constructor: new () => XMLHttpRequest;
  open: (this: XMLHttpRequest, method: string, url: string) => void;
  send: (this: XMLHttpRequest, body: FormData) => void;
}

/**
 * An XHR the browser sends itself. seedit enables CapacitorHttp on Android, which routes
 * XMLHttpRequest through the native bridge: it copies the whole file across as base64 and
 * fires no upload events. Calling the methods Capacitor saved skips that patch.
 */
function createXhr(): { xhr: XMLHttpRequest; open: (method: string, url: string) => void; send: (body: FormData) => void } {
  const webXhr = (window as Window & { CapacitorWebXMLHttpRequest?: CapacitorWebXhr }).CapacitorWebXMLHttpRequest;
  if (webXhr) {
    const xhr = new webXhr.constructor();
    return { xhr, open: (method, url) => webXhr.open.call(xhr, method, url), send: (body) => webXhr.send.call(xhr, body) };
  }
  const xhr = new XMLHttpRequest();
  return { xhr, open: (method, url) => xhr.open(method, url), send: (body) => xhr.send(body) };
}

/**
 * POSTs form data like fetch, but can report when the body has finished sending,
 * which fetch cannot. Listening for that can make the browser send a CORS preflight
 * first (the spec requires one; Chrome skips it), so a cross-origin endpoint must answer OPTIONS.
 * Rejects with a TypeError on a network failure and an AbortError when aborted, like fetch.
 */
export function postFormData(url: string, body: FormData, { signal, onBodySent }: PostFormDataOptions = {}): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const abortError = () => new DOMException('The operation was aborted.', 'AbortError');
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const { xhr, open, send } = createXhr();
    const abort = () => xhr.abort();
    const settle = () => signal?.removeEventListener('abort', abort);
    xhr.onload = () => {
      settle();
      const text = xhr.responseText;
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
        json: async () => JSON.parse(text) as unknown,
      });
    };
    xhr.onerror = () => {
      settle();
      reject(new TypeError('Network request failed'));
    };
    xhr.onabort = () => {
      settle();
      reject(abortError());
    };
    // Some browsers only dispatch upload events to listeners registered before open().
    if (onBodySent) xhr.upload.onload = () => onBodySent();
    signal?.addEventListener('abort', abort, { once: true });

    open('POST', url);
    send(body);
  });
}
