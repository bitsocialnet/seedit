// @vitest-environment jsdom

import { act, useState, type ComponentType, type Key, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Author from './author';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface CommentFixture {
  cid?: string;
  parentCid?: string;
  content?: string;
  timestamp?: number;
}

const testState = vi.hoisted(() => ({ comments: [] as CommentFixture[], hasMore: true, loadMore: vi.fn(), rowKeys: [] as Key[] }));

const RowProbe = ({ comment }: { comment: CommentFixture }) => {
  const [clicks, setClicks] = useState(0);
  return (
    <button data-row={comment.cid || comment.content} onClick={() => setClicks(clicks + 1)}>
      {clicks}
    </button>
  );
};

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAuthor: () => ({ author: { shortAddress: 'author-address' } }),
  useAuthorComments: () => ({ authorComments: testState.comments, hasMore: testState.hasMore, loadMore: testState.loadMore }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../hooks/use-window-width', () => ({ default: () => 1000 }));
vi.mock('../../components/author-sidebar', () => ({ default: () => null }));
vi.mock('../../components/error-display', () => ({ default: () => null }));
vi.mock('../../components/post', () => ({ default: ({ post }: { post: CommentFixture }) => <RowProbe comment={post} /> }));
vi.mock('../../components/reply/', () => ({ default: ({ reply }: { reply: CommentFixture }) => <RowProbe comment={reply} /> }));
vi.mock('../../components/loading-ellipsis', () => ({ default: ({ string }: { string: string }) => <span data-testid='loading'>{string}</span> }));
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    data = [],
    itemContent,
    computeItemKey,
    components,
    context,
  }: {
    data?: CommentFixture[];
    itemContent: (index: number, comment: CommentFixture) => ReactNode;
    computeItemKey?: (index: number, comment: CommentFixture) => Key;
    components: { Footer: ComponentType<{ context: unknown }> };
    context?: unknown;
  }) => {
    const Footer = components.Footer;
    testState.rowKeys = data.map((comment, index) => computeItemKey?.(index, comment) ?? index);
    return (
      <div>
        {data.map((comment, index) => (
          <div key={testState.rowKeys[index]}>{itemContent(index, comment)}</div>
        ))}
        <Footer context={context} />
      </div>
    );
  },
}));

describe('Author virtualized updates', () => {
  let container: HTMLDivElement;
  let root: Root;
  const basePath = '/u/author-address/comments/latest-cid';

  const renderAuthor = async () => {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={[basePath]}>
          <Link to={`${basePath}/comments`}>comments tab</Link>
          <Link to={`${basePath}/submitted`}>submitted tab</Link>
          <Routes>
            <Route path='/u/:authorAddress/comments/:commentCid/:section?' element={<Author />} />
          </Routes>
        </MemoryRouter>,
      ),
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    testState.comments = [{ cid: 'first-post' }, { cid: 'second-post' }];
    testState.hasMore = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('preserves published row DOM and state when comments reorder and new comments prepend', async () => {
    await renderAuthor();
    const firstRow = container.querySelector<HTMLButtonElement>('[data-row="first-post"]');
    await act(async () => firstRow?.click());
    expect(firstRow?.textContent).toBe('1');

    testState.comments = [testState.comments[1], testState.comments[0]];
    await renderAuthor();
    expect(container.querySelector('[data-row="first-post"]')).toBe(firstRow);
    expect(firstRow?.textContent).toBe('1');

    testState.comments = [{ cid: 'new-post' }, ...testState.comments];
    await renderAuthor();
    expect(container.querySelector('[data-row="first-post"]')).toBe(firstRow);
    expect(firstRow?.textContent).toBe('1');
    expect(container.querySelector('[data-row="new-post"]')?.textContent).toBe('0');
  });

  it('preserves the loading footer through updates and applies the current tab filter and loading state', async () => {
    testState.comments = [{ cid: 'first-post' }, { cid: 'reply', parentCid: 'first-post' }];
    await renderAuthor();
    const loading = container.querySelector('[data-testid="loading"]');
    expect(loading?.textContent).toBe('downloading_posts');

    testState.comments = [...testState.comments, { cid: 'new-post' }];
    await renderAuthor();
    expect(container.querySelector('[data-testid="loading"]')).toBe(loading);

    await act(async () => container.querySelector<HTMLAnchorElement>(`a[href="${basePath}/comments"]`)?.click());
    expect([...container.querySelectorAll('[data-row]')].map((row) => row.getAttribute('data-row'))).toEqual(['reply']);
    expect(container.querySelector('[data-testid="loading"]')).toBe(loading);
    expect(loading?.textContent).toBe('downloading_comments');

    await act(async () => container.querySelector<HTMLAnchorElement>(`a[href="${basePath}/submitted"]`)?.click());
    expect([...container.querySelectorAll('[data-row]')].map((row) => row.getAttribute('data-row'))).toEqual(['first-post', 'new-post']);
    expect(loading?.textContent).toBe('downloading_posts');

    testState.hasMore = false;
    await renderAuthor();
    expect(container.querySelector('[data-testid="loading"]')).toBeNull();
  });

  it('keeps CID-less entries distinct using the existing positional fallback, even with equal timestamps', async () => {
    testState.comments = [
      { content: 'pending-one', timestamp: 1 },
      { content: 'pending-two', timestamp: 1 },
    ];
    await renderAuthor();
    expect(testState.rowKeys).toEqual([0, 1]);
    const firstRow = container.querySelector<HTMLButtonElement>('[data-row="pending-one"]');
    await act(async () => firstRow?.click());
    testState.comments = testState.comments.map((comment) => ({ ...comment }));
    await renderAuthor();
    expect(container.querySelector('[data-row="pending-one"]')).toBe(firstRow);
    expect(firstRow?.textContent).toBe('1');
    expect(container.querySelector('[data-row="pending-two"]')?.textContent).toBe('0');
  });
});
