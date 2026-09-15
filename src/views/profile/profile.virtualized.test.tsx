// @vitest-environment jsdom

import { act, useState, type Key, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Profile from './profile';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface CommentFixture {
  cid?: string;
  parentCid?: string;
  content?: string;
  timestamp?: number;
}

const testState = vi.hoisted(() => ({ comments: [] as CommentFixture[], rowKeys: [] as Key[] }));

const RowProbe = ({ comment }: { comment: CommentFixture }) => {
  const [clicks, setClicks] = useState(0);
  return (
    <button data-row={comment.cid || comment.content} onClick={() => setClicks(clicks + 1)}>
      {clicks}
    </button>
  );
};

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => ({ shortAddress: 'account-address' }),
  useAccountComments: ({ filter }: { filter?: (comment: CommentFixture) => boolean } = {}) => ({
    accountComments: filter ? testState.comments.filter(filter) : testState.comments,
  }),
  useAccountVotes: () => ({ accountVotes: [] }),
  useComment: () => undefined,
}));
vi.mock('react-i18next', () => ({ Trans: () => null, useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../components/author-sidebar', () => ({ default: () => null }));
vi.mock('../../components/error-display', () => ({ default: () => null }));
vi.mock('../../components/post', () => ({ default: ({ post }: { post: CommentFixture }) => <RowProbe comment={post} /> }));
vi.mock('../../components/reply', () => ({ default: ({ reply }: { reply: CommentFixture }) => <RowProbe comment={reply} /> }));
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    data = [],
    itemContent,
    computeItemKey,
  }: {
    data?: CommentFixture[];
    itemContent: (index: number, comment: CommentFixture) => ReactNode;
    computeItemKey?: (index: number, comment: CommentFixture) => Key;
  }) => {
    testState.rowKeys = data.map((comment, index) => computeItemKey?.(index, comment) ?? index);
    return (
      <div>
        {data.map((comment, index) => (
          <div key={testState.rowKeys[index]}>{itemContent(index, comment)}</div>
        ))}
      </div>
    );
  },
}));

describe('Profile virtualized history', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderHistory = async (view: 'Overview' | 'Comments' | 'Submitted' = 'Overview') => {
    const History = Profile[view];
    await act(async () =>
      root.render(
        <MemoryRouter>
          <History />
        </MemoryRouter>,
      ),
    );
  };

  beforeEach(() => {
    testState.comments = [
      { cid: 'first-post', parentCid: undefined },
      { cid: 'second-post', parentCid: undefined },
    ];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it.each(['Overview', 'Comments', 'Submitted'] as const)('preserves published %s row DOM and state across reordering and prepending', async (view) => {
    if (view === 'Comments') testState.comments = testState.comments.map((comment) => ({ ...comment, parentCid: 'parent' }));
    await renderHistory(view);
    const firstRow = container.querySelector<HTMLButtonElement>('[data-row="first-post"]');
    await act(async () => firstRow?.click());
    expect(firstRow?.textContent).toBe('1');

    testState.comments = [testState.comments[1], testState.comments[0]];
    await renderHistory(view);
    expect(container.querySelector('[data-row="first-post"]')).toBe(firstRow);
    expect(firstRow?.textContent).toBe('1');

    testState.comments = [{ cid: 'new-post', parentCid: view === 'Comments' ? 'parent' : undefined }, ...testState.comments];
    await renderHistory(view);
    expect(container.querySelector('[data-row="first-post"]')).toBe(firstRow);
    expect(firstRow?.textContent).toBe('1');
    expect(container.querySelector('[data-row="new-post"]')?.textContent).toBe('0');
  });

  it('keeps CID-less pending rows distinct with positional fallback when timestamps match', async () => {
    testState.comments = [
      { content: 'pending-one', timestamp: 1 },
      { content: 'pending-two', timestamp: 1 },
    ];
    await renderHistory();
    expect(testState.rowKeys).toEqual([0, 1]);
    const firstRow = container.querySelector<HTMLButtonElement>('[data-row="pending-one"]');
    await act(async () => firstRow?.click());
    testState.comments = testState.comments.map((comment) => ({ ...comment }));
    await renderHistory();
    expect(container.querySelector('[data-row="pending-one"]')).toBe(firstRow);
    expect(firstRow?.textContent).toBe('1');
    expect(container.querySelector('[data-row="pending-two"]')?.textContent).toBe('0');
  });
});
