// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Reply from './reply';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  repliesByCid: {} as Record<string, Record<string, any>[]>,
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAuthorAddress: ({ comment }: { comment: Record<string, any> }) => ({ shortAuthorAddress: comment.author?.address }),
  useBlock: () => ({ blocked: false, unblock: vi.fn() }),
  useComment: () => ({}),
  useEditedComment: () => ({}),
  useCommunity: () => ({}),
}));
vi.mock('@bitsocial/bitsocial-react-hooks/dist/lib/utils/index.js', () => ({ flattenCommentsPages: () => [] }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: React.ReactNode }) => createElement('a', null, children),
  useLocation: () => ({ pathname: '/s/example.bso/comments/post-cid', search: '' }),
  useParams: () => ({ communityAddress: 'example.bso', commentCid: 'post-cid' }),
}));
vi.mock('../../hooks/use-account-comment', () => ({ default: () => undefined }));
vi.mock('../../hooks/use-replies', () => ({ default: (comment: { cid?: string }) => testState.repliesByCid[comment.cid ?? ''] ?? [] }));
vi.mock('../../hooks/use-state-string', () => ({ default: () => '' }));
vi.mock('../../hooks/use-upvote', () => ({ default: () => [false, vi.fn()] }));
vi.mock('../../hooks/use-downvote', () => ({ default: () => [false, vi.fn()] }));
vi.mock('../../hooks/use-comment-media-info', () => ({ useCommentMediaInfo: () => undefined }));
vi.mock('../../lib/utils/media-utils', () => ({ getHasThumbnail: () => false }));
vi.mock('../../lib/utils/time-utils', () => ({ formatLocalizedUTCTimestamp: () => '', getFormattedTimeAgo: () => '' }));
vi.mock('../comment-edit-form', () => ({ default: () => null }));
vi.mock('../loading-ellipsis', () => ({ default: () => null }));
vi.mock('../markdown', () => ({ default: ({ content }: { content: string }) => createElement('p', null, content) }));
vi.mock('../expand-button', () => ({ default: () => null }));
vi.mock('../expando', () => ({ default: () => null }));
vi.mock('../flair', () => ({ default: () => null }));
vi.mock('../label', () => ({ default: () => null }));
vi.mock('../thumbnail', () => ({ default: () => null }));
vi.mock('../comment-tools', () => ({
  default: ({ cid, showReplyForm }: { cid?: string; showReplyForm: () => void }) => createElement('button', { 'data-reply-button': cid, onClick: showReplyForm }, cid),
}));
vi.mock('../reply-form', () => ({
  default: ({ cid }: { cid?: string }) => createElement('textarea', { 'data-reply-draft': cid, defaultValue: '' }),
}));

let container: HTMLDivElement;
let root: Root;
const parent = { cid: 'parent', communityAddress: 'example.bso', postCid: 'post-cid', parentCid: 'post-cid', timestamp: 1, content: 'Parent reply' };
const child = (cid: string) => ({ ...parent, cid, parentCid: 'parent', content: `${cid} reply` });
const render = async () => {
  await act(async () => root.render(createElement(Reply, { reply: parent as any })));
};
const replyOrder = () => Array.from(container.querySelectorAll('[data-reply-button]')).map((element) => element.getAttribute('data-reply-button'));

describe('Nested Reply identity', () => {
  beforeEach(() => {
    testState.repliesByCid = { parent: [child('first'), child('second')], first: [child('grandchild')] };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('keeps nested reply forms and their drafts attached to their CIDs after reorder and prepend', async () => {
    await render();
    await act(async () => {
      (container.querySelector('[data-reply-button="first"]') as HTMLButtonElement).click();
      (container.querySelector('[data-reply-button="grandchild"]') as HTMLButtonElement).click();
    });
    const firstDraft = container.querySelector('[data-reply-draft="first"]') as HTMLTextAreaElement;
    const grandchildDraft = container.querySelector('[data-reply-draft="grandchild"]') as HTMLTextAreaElement;
    firstDraft.value = 'Unsent nested reply';
    grandchildDraft.value = 'Unsent deeper reply';

    testState.repliesByCid.parent = [child('second'), child('first')];
    await render();

    expect(replyOrder()).toEqual(['parent', 'second', 'first', 'grandchild']);
    expect(container.querySelector('[data-reply-draft="first"]')).toBe(firstDraft);
    expect(container.querySelector('[data-reply-draft="grandchild"]')).toBe(grandchildDraft);
    expect(firstDraft.value).toBe('Unsent nested reply');
    expect(grandchildDraft.value).toBe('Unsent deeper reply');

    testState.repliesByCid.parent = [child('newest'), ...testState.repliesByCid.parent];
    await render();

    expect(replyOrder()).toEqual(['parent', 'newest', 'second', 'first', 'grandchild']);
    expect(container.querySelector('[data-reply-draft="first"]')).toBe(firstDraft);
    expect(container.querySelector('[data-reply-draft="grandchild"]')).toBe(grandchildDraft);
    expect(firstDraft.value).toBe('Unsent nested reply');
    expect(grandchildDraft.value).toBe('Unsent deeper reply');
  });

  it('renders separate CID-less children with the same timestamp', async () => {
    testState.repliesByCid = {
      parent: [
        { ...child(''), cid: undefined, content: 'Pending one' },
        { ...child(''), cid: undefined, content: 'Pending two' },
      ],
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await render();

    expect(container.textContent).toContain('Pending one');
    expect(container.textContent).toContain('Pending two');
    expect(container.querySelectorAll('button')).toHaveLength(3);
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/same key/);
  });
});
