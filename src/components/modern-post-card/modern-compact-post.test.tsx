// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import ModernCompactPost from './modern-compact-post';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  mediaInfo: undefined as { url: string; type: string; thumbnail?: string } | undefined,
  obscuredLabel: undefined as string | undefined,
  reveal: vi.fn(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useEditedComment: () => ({ editedComment: undefined }),
  useBlock: () => ({ blocked: false, unblock: vi.fn() }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => createElement('a', { ...props, href: to }, children),
}));
vi.mock('../../hooks/use-comment-media-info', () => ({ useCommentMediaInfo: () => testState.mediaInfo }));
vi.mock('../../hooks/use-post-obscuring', () => ({
  default: () => ({ nsfw: false, obscuredLabel: testState.obscuredLabel, reveal: testState.reveal }),
}));
vi.mock('../../hooks/use-prefetch-intent', () => ({ default: () => ({}) }));
// The card's parts and the actions have their own behavior; the row's own job is what is under test.
vi.mock('./modern-post-card', () => ({
  PostMeta: () => createElement('span', { 'data-part': 'meta' }),
  PostTags: () => null,
  PostMedia: ({ link }: { link?: string }) => createElement('div', { 'data-part': 'media' }, link),
}));
vi.mock('../modern-actions', () => ({ ModernShareButton: () => null, ModernVoteButtons: () => null }));
vi.mock('../modern-comment-menu', () => ({ default: () => null }));
vi.mock('../markdown', () => ({ default: ({ content }: { content: string }) => createElement('div', { 'data-part': 'markdown' }, content) }));

let container: HTMLDivElement;
let root: Root;

const previewButton = () => container.querySelector<HTMLButtonElement>('button[aria-expanded]');
const render = (post: Partial<Comment>) =>
  act(async () => root.render(createElement(ModernCompactPost, { post: { communityAddress: 'a.bso', timestamp: 1, ...post } as Comment })));

describe('ModernCompactPost', () => {
  beforeEach(() => {
    testState.mediaInfo = undefined;
    testState.obscuredLabel = undefined;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('opens a media post in place from its preview square, and keeps it open when the row comes back', async () => {
    testState.mediaInfo = { url: 'https://example.com/cat.png', type: 'image' };
    await render({ cid: 'image-post', title: 'A cat', link: 'https://example.com/cat.png' });
    expect(previewButton()?.getAttribute('aria-label')).toBe('expand_post');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/cat.png');
    expect(container.querySelector('[data-part="media"]')).toBeNull();

    await act(async () => previewButton()!.click());
    expect(previewButton()?.getAttribute('aria-expanded')).toBe('true');
    expect(previewButton()?.getAttribute('aria-label')).toBe('collapse_post');
    const expando = container.querySelector('[data-part="media"]')!.parentElement!;
    expect(previewButton()?.getAttribute('aria-controls')).toBe(expando.id);

    // a virtualized feed unmounts rows that scroll away and mounts them again
    await act(async () => root.unmount());
    root = createRoot(container);
    await render({ cid: 'image-post', title: 'A cat', link: 'https://example.com/cat.png' });
    expect(previewButton()?.getAttribute('aria-expanded')).toBe('true');
  });

  it('opens a text post as its text, kept unreadable and out of reach until a spoiler is revealed', async () => {
    testState.obscuredLabel = 'view_spoiler';
    await render({ cid: 'text-post', title: 'A question', content: 'The **details**' });
    await act(async () => previewButton()!.click());

    const markdown = container.querySelector('[data-part="markdown"]')!;
    expect(markdown.textContent).toBe('The **details**');
    expect(markdown.parentElement?.hasAttribute('inert')).toBe(true);
    const revealButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'view_spoiler')!;
    await act(async () => revealButton.click());
    expect(testState.reveal).toHaveBeenCalled();
  });

  it('has nothing to open for a post that is only a title', async () => {
    await render({ cid: 'title-post', title: 'Just a title' });
    expect(previewButton()).toBeNull();
    const square = container.querySelector('a[aria-hidden="true"]');
    expect(square?.getAttribute('href')).toBe(container.querySelector('h3 a')?.getAttribute('href'));
    expect(square?.getAttribute('tabindex')).toBe('-1');
  });

  it('shows a link post that has no text as a link, without crashing on the missing text', async () => {
    testState.mediaInfo = { url: 'https://example.com/article', type: 'webpage' };
    await render({ cid: 'link-post', title: 'An article', link: 'https://example.com/article' });
    await act(async () => previewButton()!.click());
    expect(container.querySelector('[data-part="media"]')?.textContent).toBe('https://example.com/article');
    expect(container.querySelector('[data-part="markdown"]')).toBeNull();
  });
});
