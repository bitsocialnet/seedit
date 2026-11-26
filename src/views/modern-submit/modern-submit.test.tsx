// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import usePublishPostStore from '../../stores/use-publish-post-store';
import ModernSubmit from './modern-submit';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  submitPost: vi.fn(),
  subscriptions: ['first.bso', 'second.bso'] as string[] | undefined,
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => ({ subscriptions: testState.subscriptions }),
  useCommunity: () => undefined,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../hooks/use-submit-post', async () => {
  const { default: useStore } = await import('../../stores/use-publish-post-store');
  const useSubmitPostMock = () => ({
    communityAddress: useStore((state) => state.communityAddress),
    community: undefined,
    shortAddress: undefined,
    isOffline: false,
    offlineTitle: '',
    submitPost: testState.submitPost,
  });
  return { default: useSubmitPostMock };
});
vi.mock('../../hooks/use-post-media-dropzone', () => ({
  default: () => ({ fileKinds: ['image'], uploadPhase: null, getRootProps: () => ({}), getInputProps: () => ({}), isDragActive: false, chooseFile: vi.fn() }),
}));
vi.mock('../../hooks/use-default-subscriptions', () => ({ useDefaultSubscriptionAddresses: () => ['default.bso'] }));
vi.mock('../../components/crosspost-preview', () => ({ default: () => null }));
vi.mock('../../components/markdown', () => ({ default: ({ content }: { content: string }) => createElement('div', { 'data-preview': true }, content) }));
vi.mock('../../components/modern-community-about', () => ({ default: () => null }));
vi.mock('../../components/modern-layout', () => ({
  ModernColumns: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  modernStyles: {},
}));
vi.mock('../../components/modern-post-card', () => ({ PostMedia: ({ link }: { link: string }) => createElement('div', { 'data-media': link }) }));

let container: HTMLDivElement;
let root: Root;

const postButton = () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const chip = (address: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')).find((button) => button.title === address)!;

// React tracks a controlled field's value, so a typed value goes through the native setter.
const type = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')!.set!;
  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('ModernSubmit', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    testState.subscriptions = ['first.bso', 'second.bso'];
    usePublishPostStore.getState().resetPublishPostStore();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(createElement(ModernSubmit)));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('posts only once a community and a title are chosen', async () => {
    expect(postButton().disabled).toBe(true);

    await act(async () => chip('second.bso').click());
    expect(usePublishPostStore.getState().communityAddress).toBe('second.bso');
    expect(chip('second.bso').getAttribute('aria-pressed')).toBe('true');
    expect(postButton().disabled).toBe(true);

    await type(container.querySelector<HTMLTextAreaElement>('#modern-submit-title')!, 'A title');
    expect(postButton().disabled).toBe(false);

    await act(async () => postButton().closest('form')!.requestSubmit());
    expect(testState.submitPost).toHaveBeenCalledTimes(1);
  });

  it('suggests default communities to an account without subscriptions', async () => {
    testState.subscriptions = undefined;
    // A fresh mount, since the compiled form keeps its fields from re-rendering for the same props.
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(createElement(ModernSubmit)));
    expect(chip('default.bso')).toBeDefined();
    expect(container.textContent).toContain('submit_subscriptions_notice');
  });

  it('flags an invalid link and keeps the post from publishing', async () => {
    await act(async () => chip('first.bso').click());
    await type(container.querySelector<HTMLTextAreaElement>('#modern-submit-title')!, 'A title');
    const link = container.querySelector<HTMLInputElement>('#modern-submit-link')!;

    await type(link, 'not a url');
    expect(link.getAttribute('aria-invalid')).toBe('true');
    expect(container.textContent).toContain('invalid_url_alert');
    expect(postButton().disabled).toBe(true);

    await type(link, 'https://example.com/image.png');
    expect(link.getAttribute('aria-invalid')).toBe('false');
    expect(container.querySelector('[data-media]')?.getAttribute('data-media')).toBe('https://example.com/image.png');
    expect(postButton().disabled).toBe(false);
  });

  it('marks the draft as a spoiler or NSFW', async () => {
    const toggle = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="group"] button')).find((button) => button.textContent === label)!;
    await act(async () => toggle('spoiler').click());
    await act(async () => toggle('nsfw').click());
    expect(usePublishPostStore.getState()).toMatchObject({ spoiler: true, nsfw: true });

    await act(async () => toggle('spoiler').click());
    expect(usePublishPostStore.getState().spoiler).toBeUndefined();
  });
});
