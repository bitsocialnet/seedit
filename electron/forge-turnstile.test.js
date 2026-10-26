/**
 * Unit tests for forge-turnstile (Electron). The real widget was checked against
 * Cloudflare manually; these cover the window lifecycle and the local page server.
 */
import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronState = vi.hoisted(() => ({
  windows: [],
  protocolHandler: null,
  createPage: null,
}));

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(function BrowserWindow(options) {
    const win = new EventEmitter();
    const webContents = new EventEmitter();
    const page = electronState.createPage();
    let destroyed = false;
    let stoppedLoading = Promise.resolve();
    const read = (code) => (code === 'window.turnstileInteraction' ? page.interaction : page.result);
    webContents.setWindowOpenHandler = vi.fn();
    // As in Electron, webContents.executeJavaScript waits until the page stops loading; mainFrame's does not.
    webContents.executeJavaScript = vi.fn((code) => stoppedLoading.then(() => read(code)));
    webContents.mainFrame = { executeJavaScript: vi.fn(read) };
    Object.assign(win, {
      options,
      webContents,
      loadURL: vi.fn((url) => {
        setTimeout(() => (page.failLoad ? webContents.emit('did-fail-load', {}, -105, 'ERR_NAME_NOT_RESOLVED', url, true) : webContents.emit('dom-ready')));
        stoppedLoading = page.load ? page.load() : Promise.resolve();
        return stoppedLoading;
      }),
      show: vi.fn(),
      isDestroyed: () => destroyed,
      destroy: vi.fn(() => {
        destroyed = true;
        win.emit('closed');
      }),
    });
    electronState.windows.push(win);
    return win;
  }),
  nativeTheme: { shouldUseDarkColors: false },
  session: {
    fromPartition: vi.fn(() => ({
      setPermissionRequestHandler: vi.fn(),
      protocol: {
        handle: vi.fn((scheme, handler) => {
          electronState.protocolHandler = { scheme, handler };
        }),
      },
    })),
  },
}));

import { getForgeTurnstileToken } from './forge-turnstile.js';

const never = () => new Promise(() => {});

describe('getForgeTurnstileToken', () => {
  beforeEach(() => {
    electronState.windows = [];
    electronState.createPage = () => ({ interaction: never(), result: Promise.resolve({ token: 'token-1' }) });
  });

  it('returns the token from a hidden window on localhost and closes the window', async () => {
    await expect(getForgeTurnstileToken({ sitekey: '0x4AAAA_key-1', parent: null })).resolves.toBe('token-1');

    const [win] = electronState.windows;
    expect(win.loadURL).toHaveBeenCalledWith('http://localhost/forge-turnstile?sitekey=0x4AAAA_key-1');
    expect(win.options.show).toBe(false);
    expect(win.options.webPreferences).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false });
    expect(win.show).not.toHaveBeenCalled();
    expect(win.destroy).toHaveBeenCalledOnce();
  });

  it('serves only the widget page from its session', async () => {
    await getForgeTurnstileToken({ sitekey: 'key', parent: null });
    const { scheme, handler } = electronState.protocolHandler;

    expect(scheme).toBe('http');
    const page = await handler({ url: 'http://localhost/forge-turnstile?sitekey=key' });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('challenges.cloudflare.com/turnstile/v0/api.js');
    expect((await handler({ url: 'http://localhost:9138/' })).status).toBe(404);
    expect((await handler({ url: 'http://localhost/other' })).status).toBe(404);
  });

  it('shows the window when Cloudflare asks the user to interact', async () => {
    let resolveResult;
    electronState.createPage = () => ({ interaction: Promise.resolve(), result: new Promise((resolve) => (resolveResult = resolve)) });

    const tokenPromise = getForgeTurnstileToken({ sitekey: 'key', parent: null });
    await vi.waitFor(() => expect(electronState.windows[0].show).toHaveBeenCalledOnce());
    resolveResult({ token: 'solved' });

    await expect(tokenPromise).resolves.toBe('solved');
  });

  it('reads the result once the page script runs, even while the load event still waits on Cloudflare', async () => {
    electronState.createPage = () => ({ load: never, interaction: never(), result: Promise.resolve({ error: 'Turnstile script load timed out' }) });

    await expect(getForgeTurnstileToken({ sitekey: 'key', parent: null })).rejects.toThrow('Turnstile script load timed out');
  });

  it('rejects when the page itself fails to load', async () => {
    electronState.createPage = () => ({ failLoad: true, load: () => Promise.reject(new Error('ERR_NAME_NOT_RESOLVED')), interaction: never(), result: never() });

    await expect(getForgeTurnstileToken({ sitekey: 'key', parent: null })).rejects.toThrow('Turnstile page failed to load: -105 ERR_NAME_NOT_RESOLVED');
    expect(electronState.windows[0].destroy).toHaveBeenCalledOnce();
  });

  it('rejects with the widget error', async () => {
    electronState.createPage = () => ({ interaction: never(), result: Promise.resolve({ error: 'Turnstile error 600010' }) });

    await expect(getForgeTurnstileToken({ sitekey: 'key', parent: null })).rejects.toThrow('Turnstile error 600010');
    expect(electronState.windows[0].destroy).toHaveBeenCalledOnce();
  });

  it('rejects when the user closes the challenge window', async () => {
    electronState.createPage = () => ({ interaction: Promise.resolve(), result: never() });

    const tokenPromise = getForgeTurnstileToken({ sitekey: 'key', parent: null });
    await vi.waitFor(() => expect(electronState.windows[0].show).toHaveBeenCalledOnce());
    electronState.windows[0].emit('closed');

    await expect(tokenPromise).rejects.toThrow('Turnstile check was closed');
  });

  it('rejects when the challenge window is reloaded', async () => {
    electronState.createPage = () => ({ interaction: Promise.resolve(), result: never() });

    const tokenPromise = getForgeTurnstileToken({ sitekey: 'key', parent: null });
    await vi.waitFor(() => expect(electronState.windows[0].show).toHaveBeenCalledOnce());
    electronState.windows[0].webContents.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false });

    await expect(tokenPromise).rejects.toThrow('Turnstile check was reloaded');
    expect(electronState.windows[0].destroy).toHaveBeenCalledOnce();
  });

  it('gives up when the page never answers', async () => {
    vi.useFakeTimers();
    try {
      electronState.createPage = () => ({ interaction: never(), result: never() });

      const assertion = expect(getForgeTurnstileToken({ sitekey: 'key', parent: null })).rejects.toThrow('Turnstile check timed out');
      await vi.advanceTimersByTimeAsync(180_000);

      await assertion;
      expect(electronState.windows[0].destroy).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([undefined, '', 'bad key', 'a&b=c'])('rejects the sitekey %j without opening a window', async (sitekey) => {
    await expect(getForgeTurnstileToken({ sitekey, parent: null })).rejects.toThrow('Invalid Turnstile sitekey');
    expect(electronState.windows).toHaveLength(0);
  });
});
