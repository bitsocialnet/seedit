// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { FileRejection } from 'react-dropzone';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubmitPage from './submit';
import useChallengesStore from '../../stores/use-challenges-store';
import usePublishPostStore from '../../stores/use-publish-post-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  abandonPublish: vi.fn().mockResolvedValue(undefined),
  analyticsMock: vi.fn(),
  lastOptions: undefined as Record<string, any> | undefined,
  publishComment: vi.fn(),
  translate: vi.fn((key: string) => key),
  communityFieldRender: vi.fn(),
  uploadRender: vi.fn(),
  dropzoneOptions: undefined as { onDrop: (files: File[], rejections?: FileRejection[]) => void; accept: Record<string, string[]> } | undefined,
  openPicker: vi.fn(),
  platform: 'web',
  mediaUpload: {
    uploadPhase: null as 'uploading' | 'checking' | null,
    fileKinds: ['image', 'video'] as string[],
    accept: { 'image/png': ['.png'], 'video/mp4': ['.mp4'] } as Record<string, string[]>,
    pickAndroidMedia: vi.fn(),
    rejectMedia: vi.fn(),
    uploadMedia: vi.fn(),
  },
  urlRender: vi.fn(),
  previewRender: vi.fn(),
  crosspostRender: vi.fn(),
}));

vi.mock('../../lib/analytics', () => ({ trackPostingEvent: (...args: unknown[]) => testState.analyticsMock(...args) }));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => {
    testState.communityFieldRender();
    return { subscriptions: [] };
  },
  useCommunity: () => ({ rules: [], title: 'Example' }),
  useCrosspost: ({ crosspost }: { crosspost: { cid: string; comment: Record<string, any> } }) => {
    testState.crosspostRender();
    return { ...crosspost.comment, cid: crosspost.cid, isCommunityVerified: false };
  },
  usePublishComment: (options: Record<string, any>) => {
    testState.lastOptions = options;
    return { abandonPublish: testState.abandonPublish, index: undefined, publishComment: testState.publishComment };
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => testState.platform, isNativePlatform: () => false },
  registerPlugin: vi.fn(),
}));

vi.mock('../../hooks/use-media-upload', () => ({
  useMediaUpload: () => testState.mediaUpload,
}));

vi.mock('react-dropzone', () => ({
  ErrorCode: { FileInvalidType: 'file-invalid-type', TooManyFiles: 'too-many-files' },
  useDropzone: (options: { onDrop: (files: File[], rejections?: FileRejection[]) => void; accept: Record<string, string[]> }) => {
    testState.uploadRender();
    testState.dropzoneOptions = options;
    return { getInputProps: () => ({}), getRootProps: () => ({}), isDragActive: false, open: testState.openPicker };
  },
}));

// A fresh `t` on every render stops the React Compiler from caching translations, so `t` calls keep tracking renders.
vi.mock('react-i18next', () => ({
  Trans: ({ values }: { values?: { link?: string } }) => createElement('span', null, values?.link),
  useTranslation: () => ({ i18n: { language: 'en' }, t: (...args: Parameters<typeof testState.translate>) => testState.translate(...args) }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children?: React.ReactNode }) => createElement('a', null, children),
  useNavigate: () => vi.fn(),
}));

vi.mock('../../hooks/use-default-subscriptions', () => ({
  useDefaultSubscriptionAddresses: () => [],
}));

vi.mock('../../hooks/use-is-community-offline', () => ({
  default: () => ({ isOffline: false, offlineTitle: '' }),
}));

vi.mock('../../hooks/use-resolved-community-route', () => ({
  default: () => ({ communityAddress: 'example.bso' }),
}));

vi.mock('../../lib/utils/media-utils', () => ({ getCommentMediaInfo: () => undefined, getLinkMediaInfo: () => undefined }));
vi.mock('../../components/info-tooltip', () => ({
  default: () => {
    testState.urlRender();
    return null;
  },
}));
vi.mock('../../components/loading-ellipsis', () => ({ default: () => null }));
vi.mock('../../components/markdown', () => ({
  default: ({ content }: { content: string }) => {
    testState.previewRender();
    return createElement('div', { 'data-testid': 'content-preview' }, content);
  },
}));
vi.mock('../../components/embed', () => ({ default: () => null }));
vi.mock('../../components/reply-form/reply-form', () => ({ FormattingHelpTable: () => null }));

let container: HTMLDivElement;
let root: Root;

describe('SubmitPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    testState.lastOptions = undefined;
    testState.platform = 'web';
    testState.mediaUpload.fileKinds = ['image', 'video'];
    testState.mediaUpload.uploadPhase = null;
    useChallengesStore.setState({ challenges: [] });
    usePublishPostStore.getState().resetPublishPostStore();
    vi.stubGlobal('scrollTo', vi.fn());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(SubmitPage));
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useChallengesStore.setState({ challenges: [] });
    usePublishPostStore.getState().resetPublishPostStore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('isolates unrelated fields and the text preview from title changes while keeping publish options current', async () => {
    await act(async () => {
      usePublishPostStore.getState().setPublishPostStore({ content: 'Draft text' });
    });
    const formattingHelp = Array.from(container.querySelectorAll('span')).find((span) => span.textContent === 'formatting_help');
    expect(formattingHelp).toBeDefined();
    await act(async () => formattingHelp?.click());
    const previewButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'preview');
    expect(previewButton).toBeDefined();
    await act(async () => previewButton?.click());
    expect(container.querySelector('[data-testid="content-preview"]')?.textContent).toBe('Draft text');
    for (const renderProbe of [testState.urlRender, testState.uploadRender, testState.communityFieldRender, testState.previewRender]) {
      expect(renderProbe).toHaveBeenCalled();
    }
    vi.clearAllMocks();

    for (const title of ['N', 'Ne', 'New title']) {
      await act(async () => {
        usePublishPostStore.getState().setPublishPostStore({ title });
      });
    }

    expect(container.querySelector('textarea')?.value).toBe('New title');
    expect(testState.lastOptions).toMatchObject({ title: 'New title', content: 'Draft text', communityAddress: 'example.bso' });
    expect(testState.translate).toHaveBeenCalledWith('title');
    expect(testState.translate).not.toHaveBeenCalledWith('text');
    expect(testState.translate).not.toHaveBeenCalledWith('options');
    for (const renderProbe of [testState.urlRender, testState.uploadRender, testState.communityFieldRender, testState.previewRender]) {
      expect(renderProbe).not.toHaveBeenCalled();
    }
    expect(container.querySelector('[data-testid="content-preview"]')?.textContent).toBe('Draft text');
  });

  it('updates individual draft fields and options before publishing', async () => {
    const changeField = async (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
      await act(async () => {
        const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    const [titleField, contentField] = Array.from(container.querySelectorAll('textarea'));
    const [urlField, communityField] = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="text"]'));

    await changeField(titleField, 'Current title');
    await changeField(contentField, 'Current text');
    await changeField(urlField, 'https://example.com/current');
    await changeField(communityField, 'other.bso');
    for (const checkbox of container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
      await act(async () => checkbox.click());
    }

    expect(titleField.value).toBe('Current title');
    expect(contentField.value).toBe('Current text');
    expect(urlField.value).toBe('https://example.com/current');
    expect(communityField.value).toBe('other.bso');
    expect(testState.lastOptions).toMatchObject({
      title: 'Current title',
      content: 'Current text',
      link: 'https://example.com/current',
      communityAddress: 'other.bso',
      spoiler: true,
      nsfw: true,
    });

    const submitButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'submit');
    await act(async () => submitButton?.click());
    expect(testState.publishComment).toHaveBeenCalledOnce();
  });

  it('routes challenge cancellation to the current usePublishComment abandonPublish', async () => {
    await act(async () => {
      await testState.lastOptions?.onChallenge({ challenges: [] }, { title: 'Test post' });
    });

    expect(useChallengesStore.getState().challenges).toHaveLength(1);

    await act(async () => {
      await useChallengesStore.getState().abandonCurrentChallenge();
    });

    expect(testState.abandonPublish).toHaveBeenCalledOnce();
  });

  it('puts the published draft back in the form when the challenge is cancelled', async () => {
    const draft = { communityAddress: 'example.bso', title: 'Test post', content: 'Test content', link: 'https://example.com', spoiler: true, nsfw: true };

    await act(async () => {
      usePublishPostStore.getState().setPublishPostStore(draft as any);
    });

    const submitButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'submit');
    await act(async () => {
      submitButton?.click();
    });

    await act(async () => {
      await testState.lastOptions?.onChallenge({ challenges: [] }, { title: 'Test post' });
      // the pending post clears the form as soon as it is created
      usePublishPostStore.getState().resetPublishPostStore();
    });
    expect(usePublishPostStore.getState().title).toBe(undefined);

    await act(async () => {
      await useChallengesStore.getState().abandonCurrentChallenge();
    });

    const restoredStore = usePublishPostStore.getState();
    expect(restoredStore.title).toBe('Test post');
    expect(restoredStore.content).toBe('Test content');
    expect(restoredStore.link).toBe('https://example.com');
    expect(restoredStore.communityAddress).toBe('example.bso');
    expect(restoredStore.spoiler).toBe(true);
    expect(restoredStore.nsfw).toBe(true);
  });

  it('passes an embedded crosspost to the publish hook', async () => {
    const crosspost = {
      cid: 'source-cid',
      comment: { content: 'Source content', title: 'Source post' },
    };

    await act(async () => {
      usePublishPostStore.getState().setPublishPostStore({ crosspost, title: 'Source post' });
    });

    expect(testState.lastOptions?.crosspost).toEqual(crosspost);
    expect(container.textContent).toContain('Source post');
  });

  it('preserves the crosspost preview across draft edits and responds to cancellation', async () => {
    const crosspost = { cid: 'source-cid', comment: { content: 'Source content', title: 'Source post' } };
    await act(async () => {
      usePublishPostStore.getState().setPublishPostStore({ crosspost, title: 'Source post' });
    });
    expect(testState.crosspostRender).toHaveBeenCalled();
    testState.crosspostRender.mockClear();

    await act(async () => {
      usePublishPostStore.getState().setPublishPostStore({ title: 'New title', content: 'Added context' });
    });
    expect(testState.crosspostRender).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Source post');
    expect(testState.lastOptions).toMatchObject({ crosspost, title: 'New title', content: 'Added context' });

    const cancelButton = container.querySelector<HTMLButtonElement>('button[aria-label="cancel"]');
    expect(cancelButton).not.toBeNull();
    await act(async () => cancelButton?.click());
    expect(container.textContent).not.toContain('Source post');
    expect(usePublishPostStore.getState().crosspost).toBeUndefined();
    expect(testState.lastOptions?.crosspost).toBeUndefined();
    expect(container.querySelector('textarea')?.value).toBe('New title');
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(2);
  });
  it('uploads a dropped file through the media hosting providers and fills in the link', async () => {
    testState.mediaUpload.uploadMedia.mockResolvedValue('https://forgeimg.net/abc/photo.png');
    expect(container.textContent).toContain('image/video');
    expect(testState.dropzoneOptions?.accept).toEqual({ 'image/png': ['.png'], 'video/mp4': ['.mp4'] });

    const file = new File(['png'], 'photo.png', { type: 'image/png' });
    await act(async () => {
      testState.dropzoneOptions?.onDrop([file]);
    });

    expect(testState.mediaUpload.uploadMedia).toHaveBeenCalledWith({ kind: 'file', file, name: 'photo.png', mimeType: 'image/png' }, expect.any(Function));
    expect(usePublishPostStore.getState().link).toBe('https://forgeimg.net/abc/photo.png');
  });

  it('explains a dropped file no enabled provider takes instead of ignoring it', async () => {
    const file = new File(['heic'], 'IMG_0001.HEIC', { type: 'image/heic' });
    await act(async () => {
      testState.dropzoneOptions?.onDrop([], [{ file, errors: [{ code: 'file-invalid-type', message: 'File type must be image/png' }] }]);
    });

    expect(testState.mediaUpload.rejectMedia).toHaveBeenCalledWith({ kind: 'file', file, name: 'IMG_0001.HEIC', mimeType: 'image/heic' });
    expect(testState.mediaUpload.uploadMedia).not.toHaveBeenCalled();
  });

  it('uploads the first supported file of a multi-file drop', async () => {
    testState.mediaUpload.uploadMedia.mockResolvedValue('https://forgeimg.net/abc/second.png');
    const unsupported = new File(['heic'], 'first.heic', { type: 'image/heic' });
    const first = new File(['png'], 'second.png', { type: 'image/png' });
    const other = new File(['png'], 'third.png', { type: 'image/png' });
    await act(async () => {
      testState.dropzoneOptions?.onDrop(
        [],
        [
          { file: unsupported, errors: [{ code: 'file-invalid-type', message: 'File type must be image/png' }] },
          { file: first, errors: [{ code: 'too-many-files', message: 'Too many files' }] },
          { file: other, errors: [{ code: 'too-many-files', message: 'Too many files' }] },
        ],
      );
    });

    expect(testState.mediaUpload.uploadMedia).toHaveBeenCalledExactlyOnceWith(
      { kind: 'file', file: first, name: 'second.png', mimeType: 'image/png' },
      expect.any(Function),
    );
    expect(testState.mediaUpload.rejectMedia).not.toHaveBeenCalled();
  });

  it('opens the file picker from choose file and leaves the link empty when an upload fails', async () => {
    testState.mediaUpload.uploadMedia.mockResolvedValue(null);
    const chooseFile = Array.from(container.querySelectorAll('label')).find((label) => label.textContent === 'choose_file');
    await act(async () => chooseFile?.click());
    expect(testState.openPicker).toHaveBeenCalledOnce();

    await act(async () => {
      testState.dropzoneOptions?.onDrop([new File(['png'], 'photo.png', { type: 'image/png' })]);
    });
    expect(usePublishPostStore.getState().link).toBeUndefined();
  });

  it('holds the post until its media upload has filled in the link', async () => {
    let finishUpload: (url: string | null) => void = () => {};
    testState.mediaUpload.uploadMedia.mockImplementation(() => new Promise((resolve) => (finishUpload = resolve)));
    await act(async () => {
      usePublishPostStore.getState().setPublishPostStore({ title: 'Photo post' });
    });
    await act(async () => {
      testState.dropzoneOptions?.onDrop([new File(['png'], 'photo.png', { type: 'image/png' })]);
    });

    const submitButton = () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'submit');
    await act(async () => submitButton()?.click());
    expect(testState.publishComment).not.toHaveBeenCalled();
    expect(submitButton()?.disabled).toBe(true);

    await act(async () => finishUpload('https://forgeimg.net/abc/photo.png'));
    expect(submitButton()?.disabled).toBe(false);
    await act(async () => submitButton()?.click());
    expect(testState.publishComment).toHaveBeenCalledOnce();
    expect(testState.lastOptions?.link).toBe('https://forgeimg.net/abc/photo.png');
  });

  it('lets the post through once its upload failed or was replaced by a typed link', async () => {
    const uploads: ((url: string | null) => void)[] = [];
    testState.mediaUpload.uploadMedia.mockImplementation(() => new Promise((resolve) => uploads.push(resolve)));
    const submitButton = () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'submit');
    const dropFile = () => act(async () => testState.dropzoneOptions?.onDrop([new File(['png'], 'photo.png', { type: 'image/png' })]));

    await dropFile();
    await act(async () => uploads[0](null));
    expect(submitButton()?.disabled).toBe(false);

    // Typing a link removes the upload form, and the hook drops the upload's late result.
    await dropFile();
    await act(async () => {
      usePublishPostStore.getState().setPublishPostStore({ link: 'https://example.com/typed' });
    });
    expect(submitButton()?.disabled).toBe(false);

    // A new upload from the form shown again after clearing the link is not released by the dropped one.
    await act(async () => {
      usePublishPostStore.getState().setPublishPostStore({ link: '' });
    });
    await dropFile();
    await act(async () => uploads[1](null));
    expect(submitButton()?.disabled).toBe(true);
    await act(async () => uploads[2]('https://forgeimg.net/abc/photo.png'));
    expect(submitButton()?.disabled).toBe(false);
    expect(usePublishPostStore.getState().link).toBe('https://forgeimg.net/abc/photo.png');
  });

  it('drops a file the Android picker returns after the page is gone, without holding later posts', async () => {
    // The platform is read when the page module loads, so load a fresh copy as Android.
    testState.platform = 'android';
    vi.resetModules();
    const AndroidSubmitPage = (await import('./submit')).default;
    const androidPublishPostStore = (await import('../../stores/use-publish-post-store')).default;
    let finishPick: (media: unknown) => void = () => {};
    testState.mediaUpload.pickAndroidMedia.mockImplementation(() => new Promise((resolve) => (finishPick = resolve)));
    testState.mediaUpload.uploadMedia.mockResolvedValue('https://forgeimg.net/abc/photo.png');
    const renderPage = () => act(async () => root.render(createElement(AndroidSubmitPage)));
    await renderPage();

    const chooseFile = Array.from(container.querySelectorAll('label')).find((label) => label.textContent === 'choose_file');
    await act(async () => chooseFile?.click());
    expect(testState.mediaUpload.pickAndroidMedia).toHaveBeenCalledOnce();

    // The page goes away (a post submitted just before navigates to the profile) while the native picker is open.
    act(() => root.unmount());
    await act(async () => finishPick({ kind: 'picked', id: 'pick-1', name: 'photo.png', mimeType: 'image/png', webPath: 'blob:photo' }));
    expect(testState.mediaUpload.uploadMedia).not.toHaveBeenCalled();
    expect(androidPublishPostStore.getState().isUploadingMedia).toBe(false);

    root = createRoot(container);
    await renderPage();
    const submitButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'submit');
    expect(submitButton?.disabled).toBe(false);
  });

  it('counts a failed upload as a failed post attempt', async () => {
    testState.mediaUpload.uploadMedia.mockImplementation(async (_media: unknown, onFailed?: () => void) => {
      onFailed?.();
      return null;
    });
    await act(async () => {
      testState.dropzoneOptions?.onDrop([new File(['png'], 'photo.png', { type: 'image/png' })]);
    });
    expect(testState.analyticsMock.mock.calls).toEqual([['post_upload_failed', { kind: 'post' }]]);
  });

  it('counts a post the form rejects, without publishing it', async () => {
    vi.stubGlobal('alert', vi.fn());
    const submitButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'submit');
    await act(async () => submitButton?.click());

    expect(alert).toHaveBeenCalledWith('Missing title');
    expect(testState.publishComment).not.toHaveBeenCalled();
    expect(testState.analyticsMock.mock.calls).toEqual([['post_validation_failed', { kind: 'post' }]]);
  });

  it('reports a failed publish to the attempt the post was submitted with, and nothing for a submit', async () => {
    vi.stubGlobal('alert', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      usePublishPostStore.getState().setPublishPostStore({ communityAddress: 'example.bso', title: 'Private title' } as any);
    });
    const submitButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'submit');
    await act(async () => submitButton?.click());
    expect(testState.publishComment).toHaveBeenCalledOnce();
    expect(testState.analyticsMock).not.toHaveBeenCalled();

    testState.lastOptions?.onError(new Error('network down'));
    testState.lastOptions?.onError(new Error('network down'));

    expect(testState.analyticsMock.mock.calls).toEqual([['post_publish_failed', { kind: 'post' }]]);
    expect(alert).toHaveBeenCalledWith('network down');
  });

  it('hides the upload box when uploads are turned off', async () => {
    testState.mediaUpload.fileKinds = [];
    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(SubmitPage));
    });

    expect(container.textContent).not.toContain('choose_file');
  });
});
