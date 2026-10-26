// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FileUploader from '../plugins/file-uploader';
import { ensureProviderAvailability, getMediaHostingRuntime, orchestrateUpload, type AttachedMedia, type MediaHostingRuntime } from '../lib/media-hosting';
import useMediaHostingStore from '../stores/use-media-hosting-store';
import { useMediaUpload } from './use-media-upload';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../plugins/file-uploader', () => ({
  default: { pickMedia: vi.fn(), uploadPickedMedia: vi.fn(), uploadGeneratedMedia: vi.fn() },
}));

vi.mock('../lib/media-hosting', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/media-hosting')>()),
  ensureProviderAvailability: vi.fn(async () => ({})),
  getMediaHostingRuntime: vi.fn(() => 'web'),
  orchestrateUpload: vi.fn(),
  // Stripping is covered by its own tests; here it passes the file through.
  stripMediaMetadata: vi.fn(async (file: File) => file),
}));

let container: HTMLDivElement;
let latestValue: ReturnType<typeof useMediaUpload>;
let root: Root;
let alertMock: ReturnType<typeof vi.fn>;

const HookHarness = () => {
  latestValue = useMediaUpload();
  return null;
};

const fileMedia = (name: string, type: string): AttachedMedia => {
  const file = new File(['x'], name, { type });
  return { kind: 'file', file, name, mimeType: type };
};

const pickedMedia: AttachedMedia = { kind: 'picked', id: 'picked-1', name: 'photo.jpg', mimeType: 'image/jpeg', webPath: 'https://localhost/_capacitor_content_/photo' };

// The runtime is fixed for an app session (and memoized by the React Compiler), so remount to change it.
const setRuntime = (runtime: MediaHostingRuntime) => {
  vi.mocked(getMediaHostingRuntime).mockReturnValue(runtime);
  act(() => root.unmount());
  root = createRoot(container);
  act(() => root.render(createElement(HookHarness)));
};

const upload = async (media: AttachedMedia) => {
  let url: string | null = null;
  await act(async () => {
    url = await latestValue.uploadMedia(media);
  });
  return url;
};

describe('useMediaUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMediaHostingRuntime).mockReturnValue('web');
    vi.mocked(ensureProviderAvailability).mockResolvedValue({});
    alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    useMediaHostingStore.setState({ uploadMode: 'preferred', preferredProvider: 'forge' });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(createElement(HookHarness)));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('uploads to Forge Images by default and offers the kinds of file it hosts', async () => {
    vi.mocked(orchestrateUpload).mockResolvedValue({ url: 'https://forgeimg.net/abc.png' });
    const media = fileMedia('a.png', 'image/png');

    expect(latestValue.fileKinds).toEqual(['image', 'video']);
    await expect(upload(media)).resolves.toBe('https://forgeimg.net/abc.png');
    expect(orchestrateUpload).toHaveBeenCalledWith(media.kind === 'file' && media.file, ['forge'], expect.any(Function));
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('offers nothing and refuses to upload when uploads are turned off', async () => {
    act(() => useMediaHostingStore.setState({ uploadMode: 'none' }));

    expect(latestValue.fileKinds).toEqual([]);
    await expect(upload(fileMedia('a.png', 'image/png'))).resolves.toBeNull();
    expect(orchestrateUpload).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith('upload_failed: Uploads are turned off in the media hosting settings');
  });

  it('sends a file only to the providers that host its kind', async () => {
    setRuntime('electron');
    act(() => useMediaHostingStore.setState({ uploadMode: 'random' }));
    vi.mocked(orchestrateUpload).mockResolvedValue({ url: 'https://files.catbox.moe/abc.pdf' });

    expect(latestValue.fileKinds).toEqual(['image', 'video', 'audio', 'pdf']);
    await expect(upload(fileMedia('paper.pdf', 'application/pdf'))).resolves.toBe('https://files.catbox.moe/abc.pdf');
    expect(vi.mocked(orchestrateUpload).mock.calls[0][1]).toEqual(['catbox']);
  });

  it('explains when the chosen provider cannot host the file', async () => {
    setRuntime('electron');

    await expect(upload(fileMedia('song.mp3', 'audio/mpeg'))).resolves.toBeNull();
    expect(orchestrateUpload).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith('upload_failed: Forge Images cannot host this type of file. upload_failed_preferred_guidance');
  });

  it('suggests another provider only when one can host the file', async () => {
    setRuntime('android');
    act(() => useMediaHostingStore.setState({ preferredProvider: 'catbox' }));
    vi.mocked(FileUploader.uploadPickedMedia).mockRejectedValue(new Error('Unable to resolve host "catbox.moe"'));

    await upload({ ...pickedMedia, name: 'song.mp3', mimeType: 'audio/mpeg' });
    expect(alertMock).toHaveBeenLastCalledWith('upload_failed: Unable to resolve host "catbox.moe"');

    await upload(pickedMedia);
    expect(alertMock).toHaveBeenLastCalledWith(expect.stringContaining('upload_failed_preferred_guidance'));
  });

  it('tries the only enabled provider without waiting on a reachability probe', async () => {
    vi.mocked(ensureProviderAvailability).mockResolvedValue({ forge: 'unavailable' });
    vi.mocked(orchestrateUpload).mockResolvedValue({ url: 'https://forgeimg.net/abc.png' });

    await expect(upload(fileMedia('a.png', 'image/png'))).resolves.toBe('https://forgeimg.net/abc.png');
    expect(ensureProviderAvailability).not.toHaveBeenCalled();
  });

  it('skips unreachable providers in random mode, and tries them all when none passed the probe', async () => {
    setRuntime('electron');
    act(() => useMediaHostingStore.setState({ uploadMode: 'random' }));
    vi.mocked(orchestrateUpload).mockResolvedValue({ url: 'https://files.catbox.moe/a.png' });

    vi.mocked(ensureProviderAvailability).mockResolvedValue({ forge: 'unavailable', imgur: 'unavailable', imgbb: 'unavailable' });
    await upload(fileMedia('a.png', 'image/png'));
    expect(vi.mocked(orchestrateUpload).mock.calls[0][1]).toEqual(['catbox']);

    vi.mocked(ensureProviderAvailability).mockResolvedValue({ forge: 'unavailable', catbox: 'unavailable', imgur: 'unavailable', imgbb: 'unavailable' });
    await upload(fileMedia('a.png', 'image/png'));
    expect([...vi.mocked(orchestrateUpload).mock.calls[1][1]].sort()).toEqual(['catbox', 'forge', 'imgbb', 'imgur']);
  });

  it('drops the result and alerts of an upload that finishes after its form is gone', async () => {
    let finish: (value: { url: string; awaitingReview: boolean }) => void = () => {};
    vi.mocked(orchestrateUpload).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    let pending: Promise<string | null> = Promise.resolve(null);
    await act(async () => {
      pending = latestValue.uploadMedia(fileMedia('a.png', 'image/png'));
    });
    act(() => root.unmount());
    finish({ url: 'https://forgeimg.net/abc.png', awaitingReview: true });

    await expect(pending).resolves.toBeNull();
    expect(alertMock).not.toHaveBeenCalled();
    root = createRoot(container);
  });

  it('shows a single failed attempt as a plain error, without guidance on web', async () => {
    vi.mocked(orchestrateUpload).mockRejectedValue(
      Object.assign(new Error('All providers failed'), { attempts: [{ provider: 'forge', success: false, error: 'Turnstile check failed: Turnstile error 110200' }] }),
    );

    await expect(upload(fileMedia('a.png', 'image/png'))).resolves.toBeNull();
    expect(alertMock).toHaveBeenCalledWith('upload_failed: Turnstile check failed: Turnstile error 110200');
  });

  it('lists every attempt when several providers failed', async () => {
    setRuntime('electron');
    act(() => useMediaHostingStore.setState({ uploadMode: 'random' }));
    vi.mocked(orchestrateUpload).mockRejectedValue(
      Object.assign(new Error('All providers failed'), {
        attempts: [
          { provider: 'forge', success: false, error: 'rate limited', stage: 'provider_error' },
          { provider: 'catbox', success: false, error: 'Network error', stage: 'unknown' },
        ],
      }),
    );

    await upload(fileMedia('a.png', 'image/png'));
    expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(/^upload_failed\. upload_failed_all_providers: forge: rate limited .*; catbox: Network error/));
  });

  it('returns the link of a file still in review and says it will start working once approved', async () => {
    vi.mocked(orchestrateUpload).mockResolvedValue({ url: 'https://forgeimg.net/abc.mp4', awaitingReview: true });

    await expect(upload(fileMedia('a.mp4', 'video/mp4'))).resolves.toBe('https://forgeimg.net/abc.mp4');
    expect(alertMock).toHaveBeenCalledWith('upload_awaiting_review');
  });

  it('tracks the upload phase while an upload runs', async () => {
    let finish: (value: { url: string }) => void = () => {};
    vi.mocked(orchestrateUpload).mockImplementation((_file, _order, onPhaseChange) => {
      onPhaseChange?.('checking');
      return new Promise((resolve) => {
        finish = resolve;
      });
    });

    let pending: Promise<string | null> = Promise.resolve(null);
    await act(async () => {
      pending = latestValue.uploadMedia(fileMedia('a.png', 'image/png'));
    });
    expect(latestValue.uploadPhase).toBe('checking');
    await act(async () => {
      finish({ url: 'https://forgeimg.net/abc.png' });
      await pending;
    });
    expect(latestValue.uploadPhase).toBeNull();
  });

  describe('on Android', () => {
    beforeEach(() => {
      setRuntime('android');
    });

    it('picks with the MIME types the enabled providers host, and ignores a cancelled pick', async () => {
      vi.mocked(FileUploader.pickMedia).mockResolvedValueOnce({ id: 'picked-1', fileName: 'photo.jpg', mimeType: 'image/jpeg', webPath: pickedMedia.webPath });
      let picked: AttachedMedia | null = null;
      await act(async () => {
        picked = await latestValue.pickAndroidMedia();
      });
      expect(FileUploader.pickMedia).toHaveBeenCalledWith({ mimeTypes: ['image/*', 'video/*'] });
      expect(picked).toEqual(pickedMedia);

      vi.mocked(FileUploader.pickMedia).mockRejectedValueOnce(new Error('File selection cancelled'));
      await act(async () => {
        picked = await latestValue.pickAndroidMedia();
      });
      expect(picked).toBeNull();
      expect(alertMock).not.toHaveBeenCalled();
    });

    it('uploads a picked file to Forge Images from the WebView, reading it from its webPath', async () => {
      const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['jpeg'], { type: 'image/jpeg' }) }));
      vi.stubGlobal('fetch', fetchMock);
      vi.mocked(orchestrateUpload).mockResolvedValue({ url: 'https://forgeimg.net/abc.jpg' });

      await expect(upload(pickedMedia)).resolves.toBe('https://forgeimg.net/abc.jpg');
      expect(fetchMock).toHaveBeenCalledWith(pickedMedia.webPath);
      const [file, order] = vi.mocked(orchestrateUpload).mock.calls[0];
      expect(file).toMatchObject({ name: 'photo.jpg', type: 'image/jpeg' });
      expect(order).toEqual(['forge']);
      expect(FileUploader.uploadPickedMedia).not.toHaveBeenCalled();
    });

    it('uploads a picked file to the other providers through the native plugin', async () => {
      act(() => useMediaHostingStore.setState({ preferredProvider: 'catbox' }));
      vi.mocked(FileUploader.uploadPickedMedia).mockResolvedValue({ url: 'https://files.catbox.moe/abc.jpg', fileName: 'photo.jpg', provider: 'catbox' });

      await expect(upload(pickedMedia)).resolves.toBe('https://files.catbox.moe/abc.jpg');
      expect(FileUploader.uploadPickedMedia).toHaveBeenCalledWith({ id: 'picked-1', providerOrder: ['catbox'] });
      expect(orchestrateUpload).not.toHaveBeenCalled();
    });

    it('merges the attempts of Forge Images and the plugin when all of them fail', async () => {
      act(() => useMediaHostingStore.setState({ uploadMode: 'random' }));
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, blob: async () => new Blob(['jpeg']) })),
      );
      vi.mocked(orchestrateUpload).mockRejectedValue(
        Object.assign(new Error('All providers failed'), { attempts: [{ provider: 'forge', success: false, error: 'forge down' }] }),
      );
      vi.mocked(FileUploader.uploadPickedMedia).mockRejectedValue(
        Object.assign(new Error('Upload failed'), {
          data: { attempts: [{ provider: 'catbox', success: false, error: 'catbox down', stage: 'upload_timed_out' }] },
        }),
      );

      await expect(upload(pickedMedia)).resolves.toBeNull();
      const message = alertMock.mock.calls[0][0] as string;
      expect(message).toContain('forge: forge down');
      expect(message).toContain('catbox: catbox down (stage=timeout)');
    });
  });
});
