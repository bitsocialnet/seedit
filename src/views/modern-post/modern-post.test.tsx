// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModernPost from './modern-post';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

type TestComment = Record<string, any>;

const testState = vi.hoisted(() => ({
  page: {} as Record<string, any>,
  comments: {} as Record<string, Record<string, any>>,
  replies: [] as Record<string, any>[],
  account: { author: { address: 'reader.bso' } },
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => testState.account,
  useComment: ({ commentCid }: { commentCid?: string }) => (commentCid && testState.comments[commentCid]) || {},
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => createElement('a', { href: to }, children),
}));
vi.mock('../../hooks/use-post-page', () => ({ default: () => testState.page }));
vi.mock('../../hooks/use-sorted-replies', () => ({ default: () => testState.replies }));
vi.mock('../../hooks/use-state-string', () => ({ default: () => '' }));
vi.mock('../../components/error-display', () => ({ default: () => null }));
vi.mock('../../components/over-18-warning', () => ({ default: () => createElement('div', { 'data-over-18': true }) }));
vi.mock('../../components/modern-community-about', () => ({ default: () => null }));
vi.mock('../../components/modern-layout', () => ({
  ModernColumns: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  modernStyles: {},
}));
vi.mock('../../components/modern-reply-form', () => ({
  default: ({ cid }: { cid: string }) => createElement('form', { 'data-reply-form': cid }),
}));
vi.mock('../../components/modern-comment', () => ({
  default: ({ reply, highlightCid, canReply, canVote }: { reply: TestComment; highlightCid?: string; canReply: boolean; canVote: boolean }) =>
    createElement('div', { 'data-comment': reply.cid, 'data-highlight': highlightCid ?? '', 'data-can-reply': String(canReply), 'data-can-vote': String(canVote) }),
}));
vi.mock('./modern-post-detail', () => ({
  default: ({ post }: { post: TestComment }) => createElement('article', { 'data-post': post.cid }),
}));

const post = (fields: TestComment = {}): TestComment => ({ cid: 'post-cid', communityAddress: 'example.bso', timestamp: 1, title: 'A post', replyCount: 2, ...fields });

let container: HTMLDivElement;
let root: Root;

const render = async () => {
  await act(async () => root.render(createElement(ModernPost)));
};
const comments = () =>
  Array.from(container.querySelectorAll('[data-comment]')).map((element) => ({
    cid: element.getAttribute('data-comment'),
    highlight: element.getAttribute('data-highlight'),
    canReply: element.getAttribute('data-can-reply'),
    canVote: element.getAttribute('data-can-vote'),
  }));

describe('ModernPost', () => {
  beforeEach(() => {
    testState.page = { post: post(), community: { roles: {} }, communityAddress: 'example.bso', isInPostContextView: false, isNsfwGated: false, shouldShowError: false };
    testState.comments = {};
    testState.replies = [
      { cid: 'first', postCid: 'post-cid', parentCid: 'post-cid' },
      { cid: 'second', postCid: 'post-cid', parentCid: 'post-cid' },
    ];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('shows an open post with a comment form and replyable comments', async () => {
    await render();

    expect(container.querySelector('[data-post]')?.getAttribute('data-post')).toBe('post-cid');
    expect(container.querySelector('[data-reply-form]')?.getAttribute('data-reply-form')).toBe('post-cid');
    expect(container.textContent).toContain('all_comments');
    expect(comments()).toEqual([
      { cid: 'first', highlight: '', canReply: 'true', canVote: 'true' },
      { cid: 'second', highlight: '', canReply: 'true', canVote: 'true' },
    ]);
  });

  it('closes a locked post to new comments and votes and says so', async () => {
    testState.page.post = post({ locked: true });
    await render();

    expect(container.querySelector('[data-reply-form]')).toBeNull();
    expect(container.textContent).toContain('post_locked_info');
    expect(comments().every((comment) => comment.canReply === 'false' && comment.canVote === 'false')).toBe(true);
  });

  it('lets a moderator reply on a locked post, without votes', async () => {
    testState.page.post = post({ locked: true });
    testState.page.community = { roles: { 'reader.bso': { role: 'moderator' } } };
    await render();

    expect(container.querySelector('[data-reply-form]')).not.toBeNull();
    expect(container.textContent).not.toContain('post_locked_info');
    expect(comments().every((comment) => comment.canReply === 'true' && comment.canVote === 'false')).toBe(true);
  });

  it('shows a linked reply as its own thread under the post, highlighted', async () => {
    testState.comments['post-cid'] = post();
    testState.page.post = { cid: 'reply-cid', communityAddress: 'example.bso', timestamp: 2, postCid: 'post-cid', parentCid: 'first' };
    await render();

    expect(container.querySelector('[data-post]')?.getAttribute('data-post')).toBe('post-cid');
    expect(container.textContent).toContain('single_comment_notice');
    expect(container.querySelector('a')?.getAttribute('href')).toContain('/comments/post-cid');
    expect(comments()).toEqual([{ cid: 'reply-cid', highlight: 'reply-cid', canReply: 'true', canVote: 'true' }]);
  });

  it('shows a context link from the reply’s top-level ancestor', async () => {
    const reply = { cid: 'reply-cid', communityAddress: 'example.bso', timestamp: 2, postCid: 'post-cid', parentCid: 'first', replyCount: 0 };
    const first = {
      cid: 'first',
      communityAddress: 'example.bso',
      timestamp: 1,
      postCid: 'post-cid',
      parentCid: 'post-cid',
      replyCount: 1,
      replies: { pages: { topAll: { comments: [reply] } } },
    };
    testState.comments['post-cid'] = post({ replies: { pages: { topAll: { comments: [first] } } } });
    testState.comments.first = first;
    testState.page.post = reply;
    testState.page.isInPostContextView = true;
    await render();

    expect(comments()).toEqual([{ cid: 'first', highlight: 'reply-cid', canReply: 'true', canVote: 'true' }]);
  });

  it('shows the over-18 warning instead of a gated post', async () => {
    testState.page.isNsfwGated = true;
    await render();

    expect(container.querySelector('[data-over-18]')).not.toBeNull();
    expect(container.querySelector('[data-post]')).toBeNull();
  });
});
