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
  saved: false,
  saveComment: vi.fn(),
  unsaveComment: vi.fn(),
  block: vi.fn(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useEditedComment: () => ({ editedComment: undefined }),
  useBlock: () => ({ blocked: false, block: testState.block, unblock: vi.fn() }),
  useSaveComment: () => ({ saved: testState.saved, saveComment: testState.saveComment, unsaveComment: testState.unsaveComment }),
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
vi.mock('../modern-layout', () => ({ modernStyles: {} }));

let container: HTMLDivElement;
let root: Root;

const expandButton = () => container.querySelector<HTMLButtonElement>('button[aria-label$="_post"]');
const button = (label: string) => Array.from(container.querySelectorAll('button')).find((element) => element.textContent === label)!;
const render = (post: Partial<Comment>) =>
  act(async () => root.render(createElement(ModernCompactPost, { post: { communityAddress: 'a.bso', timestamp: 1, ...post } as Comment })));

describe('ModernCompactPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.mediaInfo = undefined;
    testState.obscuredLabel = undefined;
    testState.saved = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('opens a media post in place from its expand button, and keeps it open when the row comes back', async () => {
    testState.mediaInfo = { url: 'https://example.com/cat.png', type: 'image' };
    await render({ cid: 'image-post', title: 'A cat', link: 'https://example.com/cat.png' });
    expect(expandButton()?.getAttribute('aria-label')).toBe('expand_post');
    expect(expandButton()?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/cat.png');
    expect(container.querySelector('[data-part="media"]')).toBeNull();

    await act(async () => expandButton()!.click());
    expect(expandButton()?.getAttribute('aria-expanded')).toBe('true');
    expect(expandButton()?.getAttribute('aria-label')).toBe('collapse_post');
    const expando = container.querySelector('[data-part="media"]')!.parentElement!;
    expect(expandButton()?.getAttribute('aria-controls')).toBe(expando.id);

    // a virtualized feed unmounts rows that scroll away and mounts them again
    await act(async () => root.unmount());
    root = createRoot(container);
    await render({ cid: 'image-post', title: 'A cat', link: 'https://example.com/cat.png' });
    expect(expandButton()?.getAttribute('aria-expanded')).toBe('true');
  });

  it('opens a text post as its text, kept unreadable and out of reach until a spoiler is revealed', async () => {
    testState.obscuredLabel = 'view_spoiler';
    await render({ cid: 'text-post', title: 'A question', content: 'The **details**' });
    await act(async () => expandButton()!.click());

    const markdown = container.querySelector('[data-part="markdown"]')!;
    expect(markdown.textContent).toBe('The **details**');
    expect(markdown.parentElement?.hasAttribute('inert')).toBe(true);
    await act(async () => button('view_spoiler').click());
    expect(testState.reveal).toHaveBeenCalled();
  });

  it('has nothing to open for a post that is only a title', async () => {
    await render({ cid: 'title-post', title: 'Just a title' });
    expect(expandButton()?.disabled).toBe(true);
    expect(expandButton()?.hasAttribute('aria-expanded')).toBe(false);
  });

  it('saves and hides from the row', async () => {
    await render({ cid: 'saved-post', title: 'Worth keeping' });
    await act(async () => button('save').click());
    expect(testState.saveComment).toHaveBeenCalled();
    await act(async () => button('hide').click());
    expect(testState.block).toHaveBeenCalled();

    testState.saved = true;
    await render({ cid: 'saved-post', title: 'Worth keeping' });
    await act(async () => button('unsave').click());
    expect(testState.unsaveComment).toHaveBeenCalled();
  });

  it('shows a link post that has no text as a link, without crashing on the missing text', async () => {
    testState.mediaInfo = { url: 'https://example.com/article', type: 'webpage' };
    await render({ cid: 'link-post', title: 'An article', link: 'https://example.com/article' });
    await act(async () => expandButton()!.click());
    expect(container.querySelector('[data-part="media"]')?.textContent).toBe('https://example.com/article');
    expect(container.querySelector('[data-part="markdown"]')).toBeNull();
  });
});
