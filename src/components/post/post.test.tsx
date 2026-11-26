// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Post from './post';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  thumbnailProps: undefined as Record<string, any> | undefined,
  expandoProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAuthorAddress: () => ({ shortAuthorAddress: 'author', authorAddressChanged: false }),
  useBlock: () => ({ blocked: false, unblock: vi.fn() }),
  useComment: () => ({}),
  useEditedComment: () => ({}),
  useCommunity: () => ({}),
  useSubscribe: () => ({ subscribe: vi.fn(), subscribed: false }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => createElement('a', { 'data-to': to }, children),
  useLocation: () => ({ pathname: '/s/example.bso/comments/post-cid', search: '' }),
  useParams: () => ({ communityAddress: 'example.bso', commentCid: 'post-cid' }),
}));
vi.mock('../../hooks/use-upvote', () => ({ default: () => [false, vi.fn()] }));
vi.mock('../../hooks/use-downvote', () => ({ default: () => [false, vi.fn()] }));
vi.mock('../../hooks/use-is-mobile', () => ({ default: () => false }));
vi.mock('../../hooks/use-is-nsfw-community', () => ({ useIsNsfwCommunity: () => false }));
vi.mock('../../hooks/use-comment-tripcode', () => ({ default: () => undefined }));
vi.mock('../../hooks/use-prefetch-intent', () => ({ default: () => ({}) }));
vi.mock('../../hooks/use-window-width', () => ({ default: () => 1200 }));
vi.mock('../../lib/utils/time-utils', () => ({ formatLocalizedUTCTimestamp: () => '', getFormattedTimeAgo: () => '' }));
vi.mock('../comment-edit-form', () => ({ default: () => null }));
vi.mock('../comment-tools', () => ({ default: () => null }));
vi.mock('../crosspost-preview', () => ({ default: () => null }));
vi.mock('../expand-button', () => ({ default: () => null }));
vi.mock('../flair', () => ({ default: () => null }));
vi.mock('../markdown', () => ({ loadMarkdown: () => Promise.resolve() }));
vi.mock('../thumbnail', () => ({
  default: (props: Record<string, any>) => {
    testState.thumbnailProps = props;
    return null;
  },
}));
vi.mock('../expando', () => ({
  default: (props: Record<string, any>) => {
    testState.expandoProps = props;
    return null;
  },
}));

const imageLink = 'https://i.example.com/photo.png';
const imagePost = {
  cid: 'post-cid',
  communityAddress: 'example.bso',
  timestamp: 1,
  title: 'Interesting photo',
  content: 'Look at this',
  link: imageLink,
  linkWidth: 800,
  linkHeight: 600,
  author: { address: 'author.bso' },
};

let container: HTMLDivElement;
let root: Root;

const render = async (post: Record<string, any>) => {
  await act(async () => root.render(createElement(Post, { post: post as any })));
};

describe('Post media of author-deleted posts', () => {
  beforeEach(() => {
    testState.thumbnailProps = undefined;
    testState.expandoProps = undefined;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the link and media of a post that is not deleted', async () => {
    await render(imagePost);

    expect(testState.thumbnailProps).toMatchObject({ link: imageLink, commentMediaInfo: { type: 'image', url: imageLink } });
    expect(testState.expandoProps).toMatchObject({ link: imageLink, commentMediaInfo: { type: 'image', url: imageLink } });
    expect(container.querySelector(`a[href="${imageLink}"]`)?.textContent).toBe('Interesting photo');
  });

  it('keeps the title but hides the link and media once the author deletes the post', async () => {
    await render({ ...imagePost, deleted: true });

    expect(testState.thumbnailProps).toMatchObject({ link: undefined, linkWidth: undefined, linkHeight: undefined, commentMediaInfo: undefined, isText: true });
    expect(testState.expandoProps).toMatchObject({ link: undefined, commentMediaInfo: undefined, content: '[deleted]' });
    expect(container.querySelector(`a[href="${imageLink}"]`)).toBeNull();
    expect(container.innerHTML).not.toContain('i.example.com');
    expect(container.textContent).toContain('Interesting photo');
  });
});
