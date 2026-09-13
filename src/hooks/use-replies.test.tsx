// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import useReplies from './use-replies';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({ accountComments: [] as Comment[] }));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccountComments: () => ({ accountComments: testState.accountComments }),
}));

let container: HTMLDivElement;
let root: Root;
let hookResult: Comment[];

const HookHarness = ({ comment }: { comment: Comment }) => {
  hookResult = useReplies(comment);
  return null;
};

const pages = { best: { comments: [{ cid: 'published-1' }, { cid: 'published-2' }] } };

describe('useReplies', () => {
  beforeEach(() => {
    testState.accountComments = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('puts the newest unpublished account replies before the published page', async () => {
    testState.accountComments = [{ cid: 'published-1' }, { cid: 'pending-1' }, { cid: 'pending-2' }];

    await act(() => root.render(createElement(HookHarness, { comment: { cid: 'parent', replies: { pages } } })));

    expect(hookResult.map((reply) => reply.cid)).toEqual(['pending-2', 'pending-1', 'published-1', 'published-2']);
  });

  it('keeps the same replies array while the comment object changes but its reply pages do not', async () => {
    await act(() => root.render(createElement(HookHarness, { comment: { cid: 'parent', upvoteCount: 1, replies: { pages } } })));
    const firstResult = hookResult;

    await act(() => root.render(createElement(HookHarness, { comment: { cid: 'parent', upvoteCount: 2, replies: { pages } } })));
    expect(hookResult).toBe(firstResult);

    const updatedPages = { best: { comments: [...pages.best.comments, { cid: 'published-3' }] } };
    await act(() => root.render(createElement(HookHarness, { comment: { cid: 'parent', upvoteCount: 2, replies: { pages: updatedPages } } })));
    expect(hookResult.map((reply) => reply.cid)).toEqual(['published-1', 'published-2', 'published-3']);
  });
});
