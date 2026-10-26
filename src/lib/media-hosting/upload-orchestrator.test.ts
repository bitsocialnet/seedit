// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { orchestrateUpload } from './upload-orchestrator';
import { uploadToCatbox } from './catbox';
import { ForgeUploadError, uploadToForge } from './forge';
import type { ProviderId } from './types';

vi.mock('./catbox', () => ({
  uploadToCatbox: vi.fn(),
}));

vi.mock('./forge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./forge')>()),
  uploadToForge: vi.fn(),
}));

// Minimal JPEG: SOI + COM segment ("gps!") + SOS with entropy data.
const jpegWithComment = [0xff, 0xd8, 0xff, 0xfe, 0x00, 0x06, 0x67, 0x70, 0x73, 0x21, 0xff, 0xda, 0x00, 0x02, 0x11, 0x22];
const jpegWithoutComment = [0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x11, 0x22];

function createElectronApiMock() {
  return {
    isElectron: true,
    copyToClipboard: vi.fn(async () => ({ success: true })),
    getPlatform: vi.fn(async () => ({ platform: 'darwin' as NodeJS.Platform, arch: 'x64', version: 'v20.0.0' })),
    automateUploadMedia: vi.fn(async (options: { provider: ProviderId }) => ({ url: 'https://i.imgur.com/abc.png', provider: options.provider })),
    automateUploadGeneratedMedia: vi.fn(async (options: { provider: ProviderId }) => ({ url: 'https://i.imgur.com/generated.png', provider: options.provider })),
    isFileOnDisk: vi.fn((): boolean => true),
  };
}

describe('orchestrateUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.electronApi = undefined;
    window.isElectron = false;
  });

  it('uploads via catbox provider directly', async () => {
    vi.mocked(uploadToCatbox).mockResolvedValue('https://files.catbox.moe/a.png');
    const file = new File(['a'], 'a.png', { type: 'image/png' });

    const { url } = await orchestrateUpload(file, ['catbox']);

    expect(url).toBe('https://files.catbox.moe/a.png');
    expect(uploadToCatbox).toHaveBeenCalledWith(file);
  });

  it('uploads via forge with metadata stripped', async () => {
    vi.mocked(uploadToForge).mockResolvedValue({ url: 'https://forgeimg.net/abc/photo.jpg' });
    const file = new File([new Uint8Array(jpegWithComment)], 'photo.jpg', { type: 'image/jpeg' });

    const { url } = await orchestrateUpload(file, ['forge']);

    expect(url).toBe('https://forgeimg.net/abc/photo.jpg');
    const uploaded = vi.mocked(uploadToForge).mock.calls[0][0];
    expect(uploaded.name).toBe('photo.jpg');
    expect(Array.from(new Uint8Array(await uploaded.arrayBuffer()))).toEqual(jpegWithoutComment);
  });

  it('reports uploading as each provider starts and checking once forge has the file', async () => {
    vi.mocked(uploadToForge).mockImplementation(async (_file, options) => {
      options?.onChecking?.();
      throw new ForgeUploadError('Upload failed: 503', 'provider_error');
    });
    vi.mocked(uploadToCatbox).mockResolvedValue('https://files.catbox.moe/a.png');
    const onPhaseChange = vi.fn();

    await orchestrateUpload(new File(['a'], 'a.png', { type: 'image/png' }), ['forge', 'catbox'], onPhaseChange);

    expect(onPhaseChange.mock.calls.map(([phase]) => phase)).toEqual(['uploading', 'checking', 'uploading']);
  });

  it('passes through a forge upload that is awaiting review', async () => {
    vi.mocked(uploadToForge).mockResolvedValue({ url: 'https://forgeimg.net/abc/game.swf', awaitingReview: true });
    const file = new File(['FWS'], 'game.swf', { type: 'application/x-shockwave-flash' });

    await expect(orchestrateUpload(file, ['forge'])).resolves.toEqual({ url: 'https://forgeimg.net/abc/game.swf', awaitingReview: true });
  });

  it('records the stage carried by a forge error instead of parsing its message', async () => {
    vi.mocked(uploadToForge).mockRejectedValue(new ForgeUploadError('missing or invalid Turnstile token', 'blocked'));
    const file = new File(['a'], 'a.png', { type: 'image/png' });

    const error = (await orchestrateUpload(file, ['forge']).catch((err: unknown) => err)) as Error & { attempts: unknown[] };

    expect(error.message).toBe('All providers failed');
    expect(error.attempts).toEqual([expect.objectContaining({ provider: 'forge', success: false, error: 'missing or invalid Turnstile token', stage: 'blocked' })]);
  });

  it('strips image metadata before uploading to catbox', async () => {
    vi.mocked(uploadToCatbox).mockResolvedValue('https://files.catbox.moe/b.jpg');
    const file = new File([new Uint8Array(jpegWithComment)], 'photo.jpg', { type: 'image/jpeg' });

    await orchestrateUpload(file, ['catbox']);

    const uploaded = vi.mocked(uploadToCatbox).mock.calls[0][0];
    expect(uploaded).not.toBe(file);
    expect(uploaded.name).toBe('photo.jpg');
    expect(Array.from(new Uint8Array(await uploaded.arrayBuffer()))).toEqual(jpegWithoutComment);
  });

  it('strips image metadata before generated media automation', async () => {
    const electronApi = createElectronApiMock();
    electronApi.isFileOnDisk = vi.fn((): boolean => false);
    window.electronApi = electronApi as unknown as Window['electronApi'];

    const file = new File([new Uint8Array(jpegWithComment)], 'photo.jpg', { type: 'image/jpeg' });
    await orchestrateUpload(file, ['imgur']);

    expect(electronApi.automateUploadGeneratedMedia).toHaveBeenCalledWith({
      provider: 'imgur',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      bytes: jpegWithoutComment,
    });
  });

  it('hands a file on disk to Electron automation, which resolves its path in the preload', async () => {
    const electronApi = createElectronApiMock();
    window.electronApi = electronApi as unknown as Window['electronApi'];

    const file = new File(['x'], 'x.png', { type: 'image/png' });
    const { url } = await orchestrateUpload(file, ['imgur']);

    expect(url).toBe('https://i.imgur.com/abc.png');
    expect(electronApi.isFileOnDisk).toHaveBeenCalledWith(file);
    expect(electronApi.automateUploadMedia).toHaveBeenCalledWith({ provider: 'imgur', file });
  });

  it('routes ImgBB through Electron automation', async () => {
    const electronApi = createElectronApiMock();
    electronApi.automateUploadMedia = vi.fn(async () => ({ url: 'https://i.ibb.co/example/image.png', provider: 'imgbb' as const }));
    window.electronApi = electronApi as unknown as Window['electronApi'];

    const file = new File(['x'], 'x.png', { type: 'image/png' });
    const { url } = await orchestrateUpload(file, ['imgbb']);

    expect(url).toBe('https://i.ibb.co/example/image.png');
    expect(electronApi.automateUploadMedia).toHaveBeenCalledWith({ provider: 'imgbb', file });
  });

  it('fails with provider attempt details if no file path can be resolved', async () => {
    const electronApi = createElectronApiMock();
    electronApi.isFileOnDisk = vi.fn((): boolean => false);
    electronApi.automateUploadGeneratedMedia = undefined as unknown as typeof electronApi.automateUploadGeneratedMedia;
    window.electronApi = electronApi as unknown as Window['electronApi'];

    const file = new File(['z'], 'z.png', { type: 'image/png' });

    try {
      await orchestrateUpload(file, ['imgur']);
      throw new Error('Expected orchestrateUpload to throw');
    } catch (error) {
      const typedError = error as Error & {
        attempts?: Array<{ provider: string; error?: string; elapsedMs?: number; stage?: string }>;
      };
      expect(typedError.message).toBe('All providers failed');
      expect(typedError.attempts?.[0]?.provider).toBe('imgur');
      expect(typedError.attempts?.[0]?.error).toContain('File path unavailable and automateUploadGeneratedMedia is not available');
      expect(typedError.attempts?.[0]?.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(typedError.attempts?.[0]?.stage).toBeDefined();
    }
  });

  it('uses generated media automation when no file path can be resolved', async () => {
    const electronApi = createElectronApiMock();
    electronApi.isFileOnDisk = vi.fn((): boolean => false);
    window.electronApi = electronApi as unknown as Window['electronApi'];

    const file = new File(['abc'], 'dragged.png', { type: 'image/png' });
    const { url } = await orchestrateUpload(file, ['imgur']);

    expect(url).toBe('https://i.imgur.com/generated.png');
    expect(electronApi.automateUploadGeneratedMedia).toHaveBeenCalledWith({
      provider: 'imgur',
      fileName: 'dragged.png',
      mimeType: 'image/png',
      bytes: [97, 98, 99],
    });
    expect(electronApi.automateUploadMedia).not.toHaveBeenCalled();
  });

  it('includes stage and matchedSelectors when provider throws block/file-input errors', async () => {
    const electronApi = createElectronApiMock();
    electronApi.automateUploadMedia = vi.fn().mockRejectedValue(new Error('No file input found for imgur. Tried: input[type="file"], #upload'));
    window.electronApi = electronApi as unknown as Window['electronApi'];

    const file = new File(['x'], 'x.png', { type: 'image/png' });

    try {
      await orchestrateUpload(file, ['imgur']);
      throw new Error('Expected orchestrateUpload to throw');
    } catch (error) {
      const typedError = error as Error & {
        attempts?: Array<{ provider: string; error?: string; stage?: string; elapsedMs?: number; matchedSelectors?: string[] }>;
      };
      expect(typedError.attempts?.[0]?.provider).toBe('imgur');
      expect(typedError.attempts?.[0]?.stage).toBe('file_input');
      expect(typedError.attempts?.[0]?.matchedSelectors).toEqual(['input[type="file"]', '#upload']);
      expect(typedError.attempts?.[0]?.elapsedMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('parses submit selector failure with matchedSelectors', async () => {
    const electronApi = createElectronApiMock();
    electronApi.automateUploadMedia = vi
      .fn()
      .mockRejectedValue(new Error('No submit button found for imgur. Tried: button[type="submit"], [data-action="upload"], .upload-btn'));
    window.electronApi = electronApi as unknown as Window['electronApi'];

    const file = new File(['x'], 'x.png', { type: 'image/png' });

    try {
      await orchestrateUpload(file, ['imgur']);
      throw new Error('Expected orchestrateUpload to throw');
    } catch (error) {
      const typedError = error as Error & {
        attempts?: Array<{ provider: string; stage?: string; matchedSelectors?: string[] }>;
      };
      expect(typedError.attempts?.[0]?.provider).toBe('imgur');
      expect(typedError.attempts?.[0]?.stage).toBe('submit');
      expect(typedError.attempts?.[0]?.matchedSelectors).toEqual(['button[type="submit"]', '[data-action="upload"]', '.upload-btn']);
    }
  });

  it('parses timeout stage when upload or URL extraction times out', async () => {
    const electronApi = createElectronApiMock();
    electronApi.automateUploadMedia = vi.fn().mockRejectedValue(new Error('Upload timeout or no direct URL extracted for imgur (elapsed: 45000ms, timeout: 45000ms)'));
    window.electronApi = electronApi as unknown as Window['electronApi'];

    const file = new File(['x'], 'x.png', { type: 'image/png' });

    try {
      await orchestrateUpload(file, ['imgur']);
      throw new Error('Expected orchestrateUpload to throw');
    } catch (error) {
      const typedError = error as Error & {
        attempts?: Array<{ provider: string; stage?: string }>;
      };
      expect(typedError.attempts?.[0]?.provider).toBe('imgur');
      expect(typedError.attempts?.[0]?.stage).toBe('timeout');
    }
  });

  it('parses page_load stage when page fails to load', async () => {
    const electronApi = createElectronApiMock();
    electronApi.automateUploadMedia = vi.fn().mockRejectedValue(new Error('Page load failed: -3 net::ERR_ABORTED'));
    window.electronApi = electronApi as unknown as Window['electronApi'];

    const file = new File(['x'], 'x.png', { type: 'image/png' });

    try {
      await orchestrateUpload(file, ['imgur']);
      throw new Error('Expected orchestrateUpload to throw');
    } catch (error) {
      const typedError = error as Error & {
        attempts?: Array<{ provider: string; stage?: string }>;
      };
      expect(typedError.attempts?.[0]?.provider).toBe('imgur');
      expect(typedError.attempts?.[0]?.stage).toBe('page_load');
    }
  });

  it('parses blocked stage when captcha or challenge detected', async () => {
    const electronApi = createElectronApiMock();
    electronApi.automateUploadMedia = vi.fn().mockRejectedValue(new Error('Provider blocked: captcha, login, or challenge detected (imgur), selector: .g-recaptcha'));
    window.electronApi = electronApi as unknown as Window['electronApi'];

    const file = new File(['x'], 'x.png', { type: 'image/png' });

    try {
      await orchestrateUpload(file, ['imgur']);
      throw new Error('Expected orchestrateUpload to throw');
    } catch (error) {
      const typedError = error as Error & {
        attempts?: Array<{ provider: string; stage?: string }>;
      };
      expect(typedError.attempts?.[0]?.provider).toBe('imgur');
      expect(typedError.attempts?.[0]?.stage).toBe('blocked');
    }
  });
});
