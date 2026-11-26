// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModernDirectories from './modern-directories';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  params: {} as { directoryCode?: string },
  searchParams: new URLSearchParams(),
  setSearchParams: vi.fn(),
  registry: {
    codes: ['memes', 'news'],
    settled: true,
    defaults: {
      directories: {
        memes: { title: 'Memes', description: 'Memes of all kinds', tags: ['humor'] },
        news: { title: 'News', description: 'World news', tags: ['world'] },
      },
    },
  },
  lists: {
    memes: {
      list: {
        revision: 3,
        directoryCode: 'memes',
        communities: [
          { address: 'second.bso', score: 1, owner: 'bob.bso' },
          { address: 'first.bso', score: 5, owner: 'alice.bso' },
        ],
      },
    },
    news: { list: { revision: 1, directoryCode: 'news', communities: [{ address: 'world.bso', score: 1 }] } },
  } as Record<string, { list?: Record<string, any>; error?: Error }>,
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useCommunities: ({ communities }: { communities: { name?: string }[] }) => ({
    communities: communities.map(({ name }) => ({ address: name, createdAt: 1, title: name === 'first.bso' ? 'First' : 'Second' })),
  }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => createElement('a', { href: to, className }, children),
  useParams: () => testState.params,
  useSearchParams: () => [testState.searchParams, testState.setSearchParams],
}));
vi.mock('../../hooks/use-directory-registry', () => ({ useDirectoryRegistry: () => testState.registry }));
vi.mock('../../hooks/use-directory-list', () => ({ useDirectoryList: (code: string) => testState.lists[code] ?? {} }));
vi.mock('../../components/modern-community-about', () => ({ ModernJoinButton: ({ address }: { address: string }) => createElement('button', null, `join ${address}`) }));
vi.mock('../../components/modern-community-row', () => ({
  default: ({ address, facts }: { address: string; facts?: React.ReactNode }) => createElement('article', { 'data-address': address }, facts),
}));
vi.mock('../../components/modern-layout', () => ({
  ModernColumns: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  ModernRailSection: ({ children }: { children: React.ReactNode }) => createElement('aside', null, children),
  modernStyles: {},
}));

let container: HTMLDivElement;
let root: Root;

const render = () => act(async () => root.render(createElement(ModernDirectories)));

describe('ModernDirectories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('scrollTo', vi.fn());
    testState.params = {};
    testState.searchParams = new URLSearchParams();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('lists the directories matching the search, with each winner and a tag that searches for itself', async () => {
    testState.searchParams = new URLSearchParams('q=humor');
    await render();

    const cards = Array.from(container.querySelectorAll('ul > li')).filter((item) => item.textContent?.includes('s/'));
    expect(cards.map((card) => card.querySelector('a')?.getAttribute('href'))).toEqual(['/communities/directories/memes']);
    expect(cards[0].textContent).toContain('s/first.bso');
    expect(container.textContent).toContain('join first.bso');

    const tag = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'humor')!;
    await act(async () => tag.click());
    expect(testState.setSearchParams).toHaveBeenCalledWith(new URLSearchParams('q=humor'), { replace: true });
  });

  it('ranks a directory’s candidates by score and marks the winner', async () => {
    testState.params = { directoryCode: 'memes' };
    await render();

    const rows = Array.from(container.querySelectorAll('article'));
    expect(rows.map((row) => row.getAttribute('data-address'))).toEqual(['first.bso', 'second.bso']);
    expect(rows[0].textContent).toContain('winner');
    expect(rows[0].textContent).toContain('u/alice.bso');
    expect(rows[1].textContent).not.toContain('winner');
  });

  it('shows not found for a code that names no directory', async () => {
    testState.params = { directoryCode: 'not-a-directory' };
    await render();
    expect(container.textContent).toContain('page_not_found');
    expect(container.querySelector('article')).toBeNull();
  });
});
