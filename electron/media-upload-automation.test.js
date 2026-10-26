/**
 * Unit tests for media-upload-automation (Electron).
 * Covers direct URL detection plus BrowserWindow/CDP automation flows.
 */
import { EventEmitter } from 'node:events';
import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronState = vi.hoisted(() => ({
  createWindow: null,
  session: { setPermissionRequestHandler: () => {} },
}));

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(function BrowserWindow(options) {
    if (!electronState.createWindow) {
      throw new Error(`Missing BrowserWindow mock for ${JSON.stringify(options)}`);
    }
    return electronState.createWindow(options);
  }),
  session: { fromPartition: vi.fn(() => electronState.session) },
}));

import { BrowserWindow } from 'electron';

import { automateUploadMedia, isDirectMediaUrl } from './media-upload-automation.js';
import { MEDIA_UPLOAD_RECIPES } from './media-upload-recipes.js';

/** `page` runs Runtime.evaluate expressions in a DOM; without it they return `runtimeValues` in order. */
const createFakeBrowserWindow = ({
  attachError = null,
  loadError = null,
  subframeLoadError = false,
  getNodeId = () => 0,
  runtimeValues = [],
  page = null,
  missingBoxModel = false,
} = {}) => {
  const emitter = new EventEmitter();
  let attached = false;
  let destroyed = false;

  const sendCommand = vi.fn(async (method, params = {}) => {
    switch (method) {
      case 'DOM.enable':
      case 'Page.enable':
      case 'Input.enable':
        return {};
      case 'DOM.getDocument':
        return { root: { nodeId: 1 } };
      case 'DOM.querySelector':
        return { nodeId: getNodeId(params.selector) || 0 };
      case 'DOM.setFileInputFiles':
        return {};
      case 'DOM.getBoxModel':
        if (missingBoxModel) {
          return { model: null };
        }
        return { model: { content: [0, 0, 20, 0, 20, 20, 0, 20] } };
      case 'Runtime.evaluate':
        if (page) return { result: { value: page.window.eval(params.expression) } };
        return { result: { value: runtimeValues.length > 0 ? runtimeValues.shift() : null } };
      case 'Input.dispatchMouseEvent':
        return {};
      default:
        throw new Error(`Unhandled CDP command in test: ${method}`);
    }
  });

  const fakeWindow = {
    loadURL: vi.fn((url) => {
      queueMicrotask(() => {
        if (loadError) {
          emitter.emit('did-fail-load', {}, loadError.code ?? -1, loadError.description ?? 'load failed', url, true);
          return;
        }
        if (subframeLoadError) emitter.emit('did-fail-load', {}, -2, 'ERR_FAILED', 'https://ads.example/frame', false);
        emitter.emit('did-finish-load');
      });
      // Like Electron, the returned promise rejects when the load fails.
      return loadError ? Promise.reject(new Error(`ERR_FAILED (${loadError.code}) loading '${url}'`)) : Promise.resolve();
    }),
    destroy: vi.fn(() => {
      destroyed = true;
    }),
    isDestroyed: vi.fn(() => destroyed),
    webContents: Object.assign(emitter, {
      setWindowOpenHandler: vi.fn(),
      debugger: {
        attach: vi.fn(() => {
          if (attachError) {
            throw attachError;
          }
          attached = true;
        }),
        sendCommand,
        detach: vi.fn(() => {
          attached = false;
        }),
        isAttached: vi.fn(() => attached),
      },
    }),
  };

  return fakeWindow;
};

describe('media-upload-automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronState.createWindow = null;
  });

  describe('isDirectMediaUrl', () => {
    it('returns true for image extensions', () => {
      expect(isDirectMediaUrl('https://example.com/photo.jpg')).toBe(true);
      expect(isDirectMediaUrl('https://i.imgur.com/abc.png')).toBe(true);
      expect(isDirectMediaUrl('https://i.postimg.cc/xyz.webp')).toBe(true);
    });

    it('returns true for video extensions', () => {
      expect(isDirectMediaUrl('https://example.com/video.webm')).toBe(true);
      expect(isDirectMediaUrl('https://example.com/video.mp4')).toBe(true);
    });

    it('returns true for Flash movie extensions', () => {
      expect(isDirectMediaUrl('https://example.com/movie.swf')).toBe(true);
      expect(isDirectMediaUrl('https://example.com/movie.SWF?download=1')).toBe(true);
    });

    it('strips query strings and fragments before checking', () => {
      expect(isDirectMediaUrl('https://i.imgur.com/abc.png?size=large')).toBe(true);
      expect(isDirectMediaUrl('https://imgur.com/page.html?img=photo.jpg')).toBe(false);
      expect(isDirectMediaUrl('https://i.imgur.com/abc.png#fragment')).toBe(true);
      expect(isDirectMediaUrl('https://i.postimg.cc/xyz.webp#')).toBe(true);
    });

    it('returns false for non-direct URLs (guards against non-media pages)', () => {
      expect(isDirectMediaUrl('https://imgur.com/abc123')).toBe(false);
      expect(isDirectMediaUrl('https://imgur.com/upload')).toBe(false);
      expect(isDirectMediaUrl('')).toBe(false);
    });

    it('returns false for invalid input', () => {
      expect(isDirectMediaUrl(null)).toBe(false);
      expect(isDirectMediaUrl(undefined)).toBe(false);
    });
  });

  describe('automateUploadMedia', () => {
    it('rejects unknown providers before opening a window', async () => {
      await expect(automateUploadMedia({ provider: 'unknown', filePath: '/tmp/file.png' })).rejects.toThrow('No automation recipe for provider: unknown');
    });

    it('uploads through a hidden BrowserWindow and returns a direct media URL', async () => {
      const recipe = MEDIA_UPLOAD_RECIPES.imgur;
      const fakeWindow = createFakeBrowserWindow({
        getNodeId: (selector) => {
          if (selector === recipe.fileInputSelectorCandidates[0]) return 10;
          if (selector === recipe.submitSelectorCandidates[0]) return 20;
          return 0;
        },
        runtimeValues: ['https://i.imgur.com/uploaded.png'],
      });
      electronState.createWindow = () => fakeWindow;

      const result = await automateUploadMedia({ provider: 'imgur', filePath: '/tmp/upload.png' });

      expect(result).toEqual({ url: 'https://i.imgur.com/uploaded.png', provider: 'imgur' });
      expect(fakeWindow.loadURL).toHaveBeenCalledWith(recipe.uploadUrl);
      expect(fakeWindow.webContents.debugger.attach).toHaveBeenCalledWith('1.3');
      expect(fakeWindow.webContents.debugger.sendCommand).toHaveBeenCalledWith('DOM.setFileInputFiles', {
        nodeId: 10,
        files: ['/tmp/upload.png'],
      });
      expect(fakeWindow.webContents.debugger.sendCommand.mock.calls.filter(([method]) => method === 'Input.dispatchMouseEvent')).toHaveLength(2);
      expect(fakeWindow.webContents.debugger.detach).toHaveBeenCalledOnce();
      expect(fakeWindow.destroy).toHaveBeenCalledOnce();
    });

    it('runs the provider page in its own session, away from the CORS rewriting of the default one', async () => {
      const recipe = MEDIA_UPLOAD_RECIPES.imgur;
      const fakeWindow = createFakeBrowserWindow({
        getNodeId: (selector) => (selector === recipe.fileInputSelectorCandidates[0] ? 10 : selector === recipe.submitSelectorCandidates[0] ? 20 : 0),
        runtimeValues: ['https://i.imgur.com/uploaded.png'],
      });
      electronState.createWindow = () => fakeWindow;

      await automateUploadMedia({ provider: 'imgur', filePath: '/tmp/upload.png' });

      // The session from session.fromPartition, created once and reused across uploads.
      expect(vi.mocked(BrowserWindow).mock.calls[0][0].webPreferences.session).toBe(electronState.session);
      expect(fakeWindow.webContents.setWindowOpenHandler).toHaveBeenCalled();
    });

    it('ignores a failed iframe load when the upload page itself loads', async () => {
      const recipe = MEDIA_UPLOAD_RECIPES.imgur;
      const fakeWindow = createFakeBrowserWindow({
        subframeLoadError: true,
        getNodeId: (selector) => (selector === recipe.fileInputSelectorCandidates[0] ? 10 : selector === recipe.submitSelectorCandidates[0] ? 20 : 0),
        runtimeValues: ['https://i.imgur.com/uploaded.png'],
      });
      electronState.createWindow = () => fakeWindow;

      await expect(automateUploadMedia({ provider: 'imgur', filePath: '/tmp/upload.png' })).resolves.toEqual({
        url: 'https://i.imgur.com/uploaded.png',
        provider: 'imgur',
      });
    });

    it.each([
      ['imgbb', '<img src="https://i.ibb.co/abc/uploaded.png">', 'https://i.ibb.co/abc/uploaded.png'],
      ['imgur', '<input value="https://i.imgur.com/uploaded.png">', 'https://i.imgur.com/uploaded.png'],
    ])('reads the %s result from a fallback element that holds it in another attribute', async (provider, resultHtml, expectedUrl) => {
      const recipe = MEDIA_UPLOAD_RECIPES[provider];
      const fakeWindow = createFakeBrowserWindow({
        getNodeId: (selector) => (selector === recipe.fileInputSelectorCandidates[0] ? 10 : selector === recipe.submitSelectorCandidates[0] ? 20 : 0),
        page: new JSDOM(`<body>${resultHtml}</body>`, { runScripts: 'outside-only' }),
      });
      electronState.createWindow = () => fakeWindow;

      await expect(automateUploadMedia({ provider, filePath: '/tmp/upload.png' })).resolves.toEqual({ url: expectedUrl, provider });
    });

    it('uploads to ImgBB through the hidden BrowserWindow recipe', async () => {
      const recipe = MEDIA_UPLOAD_RECIPES.imgbb;
      const fakeWindow = createFakeBrowserWindow({
        getNodeId: (selector) => {
          if (selector === recipe.fileInputSelectorCandidates[0]) return 10;
          if (selector === recipe.submitSelectorCandidates[0]) return 20;
          return 0;
        },
        runtimeValues: [true, 'https://i.ibb.co/example/uploaded.png'],
      });
      electronState.createWindow = () => fakeWindow;

      const result = await automateUploadMedia({ provider: 'imgbb', filePath: '/tmp/upload.png' });

      expect(result).toEqual({ url: 'https://i.ibb.co/example/uploaded.png', provider: 'imgbb' });
      expect(fakeWindow.loadURL).toHaveBeenCalledWith(recipe.uploadUrl);
      expect(fakeWindow.webContents.debugger.sendCommand).toHaveBeenCalledWith('DOM.setFileInputFiles', {
        nodeId: 10,
        files: ['/tmp/upload.png'],
      });
    });

    it('fails fast when a blocked indicator is present before upload begins', async () => {
      const recipe = MEDIA_UPLOAD_RECIPES.imgur;
      const fakeWindow = createFakeBrowserWindow({
        getNodeId: (selector) => (selector === recipe.blockedIndicators[0] ? 99 : 0),
      });
      electronState.createWindow = () => fakeWindow;

      await expect(automateUploadMedia({ provider: 'imgur', filePath: '/tmp/upload.png' })).rejects.toThrow(
        `Provider blocked: captcha, login, or challenge detected (imgur), selector: ${recipe.blockedIndicators[0]}`,
      );

      expect(fakeWindow.webContents.debugger.detach).toHaveBeenCalledOnce();
      expect(fakeWindow.destroy).toHaveBeenCalledOnce();
    });

    it('errors when no file input can be found', async () => {
      const recipe = MEDIA_UPLOAD_RECIPES.imgur;
      const fakeWindow = createFakeBrowserWindow({
        getNodeId: (selector) => (selector === recipe.submitSelectorCandidates[0] ? 20 : 0),
      });
      electronState.createWindow = () => fakeWindow;

      await expect(automateUploadMedia({ provider: 'imgur', filePath: '/tmp/upload.png' })).rejects.toThrow(
        `No file input found for imgur. Tried: ${recipe.fileInputSelectorCandidates.join(', ')}`,
      );

      expect(fakeWindow.webContents.debugger.detach).toHaveBeenCalledOnce();
      expect(fakeWindow.destroy).toHaveBeenCalledOnce();
    });

    it('bubbles page-load failures and still destroys the hidden window', async () => {
      const fakeWindow = createFakeBrowserWindow({
        loadError: { code: -3, description: 'aborted' },
      });
      electronState.createWindow = () => fakeWindow;

      await expect(automateUploadMedia({ provider: 'imgur', filePath: '/tmp/upload.png' })).rejects.toThrow('Page load failed: -3 aborted');

      expect(fakeWindow.destroy).toHaveBeenCalledOnce();
    });

    it('surfaces debugger attach failures and still destroys the hidden window', async () => {
      const fakeWindow = createFakeBrowserWindow({
        attachError: new Error('attach failed'),
      });
      electronState.createWindow = () => fakeWindow;

      await expect(automateUploadMedia({ provider: 'imgur', filePath: '/tmp/upload.png' })).rejects.toThrow('attach failed');

      expect(fakeWindow.destroy).toHaveBeenCalledOnce();
    });

    it('surfaces click failures when the submit button box model is unavailable', async () => {
      const recipe = MEDIA_UPLOAD_RECIPES.imgur;
      const fakeWindow = createFakeBrowserWindow({
        getNodeId: (selector) => {
          if (selector === recipe.fileInputSelectorCandidates[0]) return 10;
          if (selector === recipe.submitSelectorCandidates[0]) return 20;
          return 0;
        },
        missingBoxModel: true,
      });
      electronState.createWindow = () => fakeWindow;

      await expect(automateUploadMedia({ provider: 'imgur', filePath: '/tmp/upload.png' })).rejects.toThrow(
        'Cannot click node: box model unavailable (element may be hidden or zero-size)',
      );

      expect(fakeWindow.webContents.debugger.detach).toHaveBeenCalledOnce();
      expect(fakeWindow.destroy).toHaveBeenCalledOnce();
    });
  });
});

describe('media-upload-automation + recipes integration', () => {
  it('imgur success extractor targets direct-media domain', () => {
    const imgurSelectors = MEDIA_UPLOAD_RECIPES.imgur.successExtractor.selectorCandidates;
    expect(imgurSelectors.some((selector) => selector.includes('i.imgur.com'))).toBe(true);
  });

  it('all providers have fallback selector chains for file input and submit', () => {
    for (const recipe of Object.values(MEDIA_UPLOAD_RECIPES)) {
      expect(recipe.fileInputSelectorCandidates.length).toBeGreaterThanOrEqual(1);
      expect(recipe.submitSelectorCandidates.length).toBeGreaterThanOrEqual(1);
      expect(recipe.successExtractor.selectorCandidates.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('imgbb success extractor targets direct-media domain', () => {
    const imgbbSelectors = MEDIA_UPLOAD_RECIPES.imgbb.successExtractor.selectorCandidates;
    expect(imgbbSelectors.some((selector) => selector.includes('i.ibb.co') || selector.includes('html-embed-medium'))).toBe(true);
  });
});
