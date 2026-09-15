// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubmitPage from './submit';
import useChallengesStore from '../../stores/use-challenges-store';
import usePublishPostStore from '../../stores/use-publish-post-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  abandonPublish: vi.fn().mockResolvedValue(undefined),
  lastOptions: undefined as Record<string, any> | undefined,
  publishComment: vi.fn(),
  translate: vi.fn((key: string) => key),
  communityFieldRender: vi.fn(),
  uploadRender: vi.fn(),
  urlRender: vi.fn(),
  previewRender: vi.fn(),
  crosspostRender: vi.fn(),
}));

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
  Capacitor: { getPlatform: () => 'web', isNativePlatform: () => false },
  registerPlugin: vi.fn(),
}));

vi.mock('../../plugins/file-uploader', () => ({
  default: { pickMedia: vi.fn(), uploadMedia: vi.fn() },
}));

vi.mock('react-dropzone', () => ({
  useDropzone: () => {
    testState.uploadRender();
    return { getInputProps: () => ({}), getRootProps: () => ({}), isDragActive: false };
  },
}));

vi.mock('react-i18next', () => ({
  Trans: ({ values }: { values?: { link?: string } }) => createElement('span', null, values?.link),
  useTranslation: () => ({ i18n: { language: 'en' }, t: testState.translate }),
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
});
