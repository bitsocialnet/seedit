// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORGE_IMAGES_API_ORIGIN, FORGE_IMAGES_MEDIA_ORIGIN, FORGE_IMAGES_TURNSTILE_SITEKEY } from './forge-images-config';
import { ForgeUploadError, uploadToForge } from './forge';
import { postFormData } from './upload-request';
import type { UploadedMedia } from './types';

// The upload POST goes through the stubbed fetch so these tests control its answer;
// upload-request-utils.test.ts covers the XHR transport itself.
vi.mock('./upload-request', () => ({
  postFormData: vi.fn((url: string, body: FormData, options: { signal?: AbortSignal; onBodySent?: () => void } = {}) => {
    options.onBodySent?.();
    return fetch(url, { method: 'POST', body, signal: options.signal });
  }),
}));

const jsonResponse = (status: number, body: unknown, statusText = '') =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  }) as Response;

const apiError = (status: number, code: string, message: string) => jsonResponse(status, { error: { code, message } });

const getToken = vi.fn(async () => 'turnstile-token');

async function uploadError(file = new File(['x'], 'x.png', { type: 'image/png' })): Promise<ForgeUploadError> {
  const error = await uploadToForge(file, { getToken }).catch((err: unknown) => err);
  expect(error).toBeInstanceOf(ForgeUploadError);
  return error as ForgeUploadError;
}

describe('uploadToForge', () => {
  beforeEach(() => {
    getToken.mockClear();
    vi.mocked(postFormData).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns the URL for a live upload', async () => {
    const url = `${FORGE_IMAGES_MEDIA_ORIGIN}/9f86d08/photo.png`;
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { url, sha256: '9f86d08', status: 'live' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadToForge(new File(['x'], 'photo.png', { type: 'image/png' }), { getToken })).resolves.toEqual({ url });
  });

  it('returns a pending SWF at once, flagged as awaiting review, without probing it', async () => {
    const url = `${FORGE_IMAGES_MEDIA_ORIGIN}/abc/game.swf`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { url, status: 'pending', mime: 'application/x-shockwave-flash' })));
    const image = vi.fn();
    vi.stubGlobal('Image', image);

    await expect(uploadToForge(new File(['x'], 'game.swf', { type: 'application/x-shockwave-flash' }), { getToken })).resolves.toEqual({
      url,
      awaitingReview: true,
    });
    expect(image).not.toHaveBeenCalled();
  });

  describe('pending images', () => {
    const url = `${FORGE_IMAGES_MEDIA_ORIGIN}/abc/photo.png`;
    let loadResults: boolean[];
    let loadedSrcs: string[];
    let fetchMock: ReturnType<typeof vi.fn>;

    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      referrerPolicy = '';
      set src(value: string) {
        loadedSrcs.push(value);
        const loaded = loadResults.shift() ?? false;
        queueMicrotask(() => (loaded ? this.onload?.() : this.onerror?.()));
      }
    }

    beforeEach(() => {
      vi.useFakeTimers();
      loadResults = [];
      loadedSrcs = [];
      vi.stubGlobal('Image', FakeImage);
      fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { url, status: 'pending', mime: 'image/png' }));
      vi.stubGlobal('fetch', fetchMock);
    });

    it('waits until a pending image serves before returning its URL', async () => {
      loadResults = [false, false, true];
      let result: UploadedMedia | undefined;
      void uploadToForge(new File(['x'], 'photo.png', { type: 'image/png' }), { getToken }).then((value) => {
        result = value;
      });

      await vi.advanceTimersByTimeAsync(1_000);
      expect(loadedSrcs).toEqual([url]);
      expect(result).toBeUndefined();
      await vi.advanceTimersByTimeAsync(2_000 + 4_000);

      expect(loadedSrcs).toEqual([url, url, url]);
      expect(result).toEqual({ url });
      // The post form checks image links with an <img> load, so the wait must use the same check, not a HEAD request.
      expect(fetchMock.mock.calls.map(([, init]) => (init as RequestInit | undefined)?.method)).toEqual(['POST']);
    });

    it('fails with a retry message when the image is still in review after the bounded wait', async () => {
      const pending = uploadToForge(new File(['x'], 'photo.png', { type: 'image/png' }), { getToken, pendingServeWaitMs: 10_000 }).catch((err: unknown) => err);

      await vi.advanceTimersByTimeAsync(10_000);
      const error = (await pending) as ForgeUploadError;

      expect(error).toBeInstanceOf(ForgeUploadError);
      expect(error.stage).toBe('provider_error');
      expect(error.message).toMatch(/still being reviewed/);
      expect(loadedSrcs.length).toBeGreaterThan(1);
    });

    it('does not wait for a live upload', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { url, status: 'live', mime: 'image/png' })));

      await expect(uploadToForge(new File(['x'], 'photo.png', { type: 'image/png' }), { getToken })).resolves.toEqual({ url });
      expect(loadedSrcs).toEqual([]);
    });
  });

  describe('pending videos', () => {
    const url = `${FORGE_IMAGES_MEDIA_ORIGIN}/abc/clip.mp4`;
    /** Per HEAD request: answer with this status, fail (network or CORS error), or never settle. */
    let headResults: Array<number | 'reject' | 'hang'>;
    let headRequests: Array<{ input: string; init: RequestInit }>;
    /** Per metadata probe: load the metadata, fail, or never settle. */
    let probeResults: Array<'loaded' | 'error' | 'hang'>;
    let videos: FakeVideo[];
    let createElementSpy: ReturnType<typeof vi.spyOn>;
    let fetchMock: ReturnType<typeof vi.fn>;

    class FakeVideo {
      onloadedmetadata: (() => void) | null = null;
      onerror: (() => void) | null = null;
      preload = '';
      muted = false;
      loadCalls = 0;
      currentSrc: string | null = null;
      set src(value: string) {
        this.currentSrc = value;
        const result = probeResults.shift() ?? 'error';
        if (result === 'hang') return;
        queueMicrotask(() => (result === 'loaded' ? this.onloadedmetadata?.() : this.onerror?.()));
      }
      removeAttribute(name: string) {
        if (name === 'src') this.currentSrc = null;
      }
      load() {
        this.loadCalls++;
      }
    }

    const stubFetch = (status: 'live' | 'pending') => {
      fetchMock = vi.fn((input: string, init?: RequestInit) => {
        if (init?.method !== 'HEAD') return Promise.resolve(jsonResponse(200, { url, status, mime: 'video/mp4' }));
        headRequests.push({ input, init });
        const result = headResults.shift() ?? 404;
        if (result === 'reject') return Promise.reject(new TypeError('Failed to fetch'));
        if (result === 'hang') {
          return new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
          });
        }
        return Promise.resolve(jsonResponse(result, null));
      });
      vi.stubGlobal('fetch', fetchMock);
    };

    const upload = (options: { pendingVideoServeWaitMs?: number } = {}) => {
      let result: UploadedMedia | undefined;
      void uploadToForge(new File(['x'], 'clip.mp4', { type: 'video/mp4' }), { getToken, ...options }).then((value) => {
        result = value;
      });
      return () => result;
    };

    beforeEach(() => {
      vi.useFakeTimers();
      headResults = [];
      headRequests = [];
      probeResults = [];
      videos = [];
      const createElement = document.createElement.bind(document);
      createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
        if (tagName !== 'video') return createElement(tagName, options);
        const video = new FakeVideo();
        videos.push(video);
        return video as unknown as HTMLVideoElement;
      }) as typeof document.createElement);
      stubFetch('pending');
    });

    afterEach(() => {
      createElementSpy.mockRestore();
    });

    it('treats a 2xx HEAD response as served without loading the video, so the codec does not matter', async () => {
      headResults = [200];
      const result = upload();

      await vi.advanceTimersByTimeAsync(1_000);

      expect(result()).toEqual({ url });
      expect(videos).toEqual([]);
      expect(headRequests).toHaveLength(1);
      expect(headRequests[0].input).toBe(url);
      expect(headRequests[0].init).toMatchObject({ method: 'HEAD', cache: 'no-store', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
      expect(headRequests[0].init.signal).toBeInstanceOf(AbortSignal);
    });

    it('keeps polling while HEAD answers 404, then returns the URL once it serves', async () => {
      headResults = [404, 200];
      const result = upload();

      await vi.advanceTimersByTimeAsync(1_000);
      expect(headRequests).toHaveLength(1);
      expect(result()).toBeUndefined();
      await vi.advanceTimersByTimeAsync(2_000);

      expect(headRequests).toHaveLength(2);
      expect(result()).toEqual({ url });
      expect(videos).toEqual([]);
    });

    it('falls back to a metadata-only load when the HEAD request fails, and returns the URL once it serves', async () => {
      headResults = ['reject', 'reject'];
      probeResults = ['error', 'loaded'];
      const result = upload();

      await vi.advanceTimersByTimeAsync(1_000);
      expect(videos).toHaveLength(1);
      expect(result()).toBeUndefined();
      await vi.advanceTimersByTimeAsync(2_000);

      expect(result()).toEqual({ url });
      expect(videos).toHaveLength(2);
      for (const video of videos) {
        expect(video).toMatchObject({ preload: 'metadata', muted: true, currentSrc: null, loadCalls: 1 });
      }
    });

    it('returns the URL flagged as awaiting review when the video still does not serve after the bounded wait', async () => {
      const result = upload({ pendingVideoServeWaitMs: 10_000 });

      await vi.advanceTimersByTimeAsync(9_999);
      expect(result()).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);

      expect(result()).toEqual({ url, awaitingReview: true });
      expect(headRequests.length).toBeGreaterThan(1);
      expect(videos).toEqual([]);
    });

    it('aborts a HEAD request that never settles at the probe timeout and retries on the next attempt', async () => {
      headResults = ['hang', 200];
      const result = upload({ pendingVideoServeWaitMs: 30_000 });

      await vi.advanceTimersByTimeAsync(1_000 + 9_999);
      expect(headRequests[0].init.signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(headRequests[0].init.signal?.aborted).toBe(true);
      expect(result()).toBeUndefined();
      await vi.advanceTimersByTimeAsync(2_000);

      expect(result()).toEqual({ url });
      expect(videos).toEqual([]);
    });

    it('abandons a metadata probe that never settles at its timeout, releasing the element', async () => {
      headResults = ['reject', 'reject'];
      probeResults = ['hang', 'loaded'];
      const result = upload({ pendingVideoServeWaitMs: 30_000 });

      await vi.advanceTimersByTimeAsync(1_000 + 9_999);
      expect(videos[0]).toMatchObject({ currentSrc: url, loadCalls: 0 });
      await vi.advanceTimersByTimeAsync(1);
      expect(videos[0]).toMatchObject({ currentSrc: null, loadCalls: 1 });
      await vi.advanceTimersByTimeAsync(2_000);

      expect(result()).toEqual({ url });
    });

    it('does not probe a live video', async () => {
      stubFetch('live');

      await expect(uploadToForge(new File(['x'], 'clip.mp4', { type: 'video/mp4' }), { getToken })).resolves.toEqual({ url });
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(headRequests).toEqual([]);
      expect(videos).toEqual([]);
    });
  });

  it('POSTs multipart with the turnstile field before the file part', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { url: `${FORGE_IMAGES_MEDIA_ORIGIN}/abc.png`, status: 'pending' })));
    const file = new File(['x'], 'photo.png', { type: 'image/png' });

    await uploadToForge(file, { getToken });

    expect(getToken).toHaveBeenCalledOnce();
    const [url, body] = vi.mocked(postFormData).mock.calls[0];
    expect(url).toBe(`${FORGE_IMAGES_API_ORIGIN}/api/upload`);
    expect(Array.from(body.keys())).toEqual(['turnstile', 'file']);
    expect(body.get('turnstile')).toBe('turnstile-token');
    expect((body.get('file') as File).name).toBe('photo.png');
  });

  it('gets the token from the Electron main process when it runs in the desktop app', async () => {
    const getForgeTurnstileToken = vi.fn(async () => 'electron-token');
    window.electronApi = { isElectron: true, getForgeTurnstileToken } as unknown as typeof window.electronApi;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { url: `${FORGE_IMAGES_MEDIA_ORIGIN}/abc.png`, status: 'live' })));

    try {
      await uploadToForge(new File(['x'], 'photo.png', { type: 'image/png' }));
    } finally {
      window.electronApi = undefined;
    }

    expect(getForgeTurnstileToken).toHaveBeenCalledWith(FORGE_IMAGES_TURNSTILE_SITEKEY);
    expect(vi.mocked(postFormData).mock.calls[0][1].get('turnstile')).toBe('electron-token');
  });

  it('reports the automated checks once the file has been sent', async () => {
    const onChecking = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { url: `${FORGE_IMAGES_MEDIA_ORIGIN}/abc.png`, status: 'live' })));

    await uploadToForge(new File(['x'], 'photo.png', { type: 'image/png' }), { getToken, onChecking });

    expect(vi.mocked(postFormData).mock.calls[0][2]?.onBodySent).toBe(onChecking);
    expect(onChecking).toHaveBeenCalledOnce();
  });

  it('fails at the blocked stage without uploading when no Turnstile token is available', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    getToken.mockRejectedValueOnce(new Error('Turnstile error 300030'));

    const error = await uploadError();

    expect(error.stage).toBe('blocked');
    expect(error.message).toBe('Turnstile check failed: Turnstile error 300030');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['turnstile_failed', 'missing or invalid Turnstile token'],
    ['banned', 'this IP or key is banned'],
  ])('maps 403 %s to the blocked stage', async (code, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiError(403, code, message)));

    const error = await uploadError();

    expect(error.stage).toBe('blocked');
    expect(error.message).toBe(message);
  });

  it.each([
    [400, 'bad_request', 'malformed request'],
    [413, 'too_large', 'file exceeds the 10485760-byte cap for its type and tier'],
    [415, 'unsupported_type', 'type not in allowlist'],
    [429, 'rate_limited', 'rate limit exceeded, retry later'],
    [451, 'blocked', 'this exact content is blocked'],
    [503, 'storage_unavailable', 'storage unreachable — uploads fail closed, retry later'],
  ])('maps %i %s to the provider_error stage with the API message', async (status, code, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiError(status, code, message)));

    const error = await uploadError();

    expect(error.stage).toBe('provider_error');
    expect(error.message).toBe(message);
  });

  it('falls back to the HTTP status for a non-JSON error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway', json: () => Promise.reject(new SyntaxError('Unexpected token <')) }),
    );

    const error = await uploadError();

    expect(error.stage).toBe('provider_error');
    expect(error.message).toBe('Upload failed: 502 Bad Gateway');
  });

  it.each(['javascript:alert(1)', 'https://evil.example/abc.png'])('rejects a success response whose URL is not on the Forge media origin: %s', async (url) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { url, status: 'live' })));

    const error = await uploadError();

    expect(error.stage).toBe('provider_error');
  });

  it('maps a network failure to the unknown stage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await uploadError();

    expect(error.stage).toBe('unknown');
    expect(error.message).toBe('Network error: Failed to fetch');
  });

  it('aborts a hung upload and maps it to the timeout stage', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const pending = uploadToForge(new File(['x'], 'x.png', { type: 'image/png' }), { getToken, timeoutMs: 5_000 }).catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(5_000);
    const error = (await pending) as ForgeUploadError;

    expect(error).toBeInstanceOf(ForgeUploadError);
    expect(error.stage).toBe('timeout');
    expect(error.message).toBe('Upload timed out after 5s');
  });
});
