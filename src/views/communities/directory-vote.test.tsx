// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectoryCandidates, DirectoryIndex, DirectoryVoteNotice } from './directory-vote';

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useCommunities: () => ({
    communities: {
      'aww.bso': { address: 'aww.bso', title: 'Aww' },
      'cute-animals.bso': { address: 'cute-animals.bso', description: 'A community for wildlife fans', title: 'Cute Animals' },
    },
  }),
}));

vi.mock('../../components/subscribe-button', async () => {
  const { createElement } = await import('react');

  return {
    default: ({ address, directoryCode, directoryRevision }: { address?: string; directoryCode?: string; directoryRevision?: number }) =>
      createElement(
        'span',
        {
          'data-directory-subscription': directoryCode,
          'data-address': address,
          'data-revision': directoryRevision,
        },
        'join',
      ),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        directory_route_currently_recommends: `s/${values?.directoryCode} currently recommends`,
        directory_candidates_count: `candidates: ${values?.count}`,
        directory_list_revision: `directory revision ${values?.revision}`,
        directory_vote_explanation: "Seedit's short s/ routes are directories: communities compete for each route, and the highest rated candidate resolves it.",
        directory_vote_not_open: 'Voting is not open yet.',
        directory_vote_eligibility_link: 'see how eligibility will work',
        directory_winner_explanation: 'Highest rated candidate, so it currently resolves this route.',
        current_winner: 'current winner:',
        search_directories: 'search directories',
        search_communities: 'search communities in this directory',
        no_directories_found: 'no directories found',
        no_matches_found_for: `no matches found for "${values?.query}"`,
        back_to_all_directories: 'back to all directories',
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../../hooks/use-directory-list', () => ({
  useDirectoryList: (directoryCode: string) => ({
    list: {
      schemaVersion: 1,
      revision: 3,
      directoryCode,
      tags: directoryCode === 'aww' ? ['animals', 'cute'] : ['discussion'],
      communities:
        directoryCode === 'aww'
          ? [
              { address: 'aww.bso', owner: 'first-owner.bso', score: 10, tags: ['cute'] },
              { address: 'cute-animals.bso', owner: 'second-owner.bso', score: 5, tags: ['animals'] },
            ]
          : [{ address: `${directoryCode}.bso` }],
    },
    loading: false,
    error: null,
  }),
}));

vi.mock('./community-item', () => ({
  default: ({ community, index, isWinner }: { community: { address: string; title?: string }; index: number; isWinner: boolean }) =>
    createElement(
      'div',
      {
        'data-community-address': community.address,
        'data-rank': index + 1,
        'data-winner': isWinner,
      },
      community.title ?? community.address,
    ),
  NoCommunitiesMessage: () => createElement('div', null, 'nothing found'),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

let root: Root;
let container: HTMLDivElement;

const render = (element: React.ReactNode) =>
  act(() => {
    root.render(createElement(HashRouter, null, element));
  });

describe('directory vote views', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.location.hash = '';
  });

  it('presents the directory index as a descriptive list with explicit winners', () => {
    render(createElement(DirectoryIndex));

    const directoryList = container.querySelector('ul[role="list"]');
    const rows = directoryList?.querySelectorAll('li');

    expect(rows).toHaveLength(11);
    expect(rows?.[0].textContent).toContain('s/askseedit: AskSeedit');
    expect(rows?.[0].textContent).toContain('Ask the Seedit community anything');
    expect(rows?.[0].textContent).toContain('current winner:');
    expect(rows?.[0].textContent).toContain('askseedit.bso');
    expect(rows?.[0].textContent).toContain('directory revision 3');
    expect(rows?.[0].textContent).toContain('discussion');
    expect(rows?.[0].textContent).toContain('join');
    expect(rows?.[0].querySelector('[data-directory-subscription="askseedit"]')?.getAttribute('data-address')).toBe('askseedit.bso');
    expect(rows?.[0].querySelector('[data-directory-subscription="askseedit"]')?.getAttribute('data-revision')).toBe('3');
    expect(rows?.[0].querySelector('[title="Highest rated candidate, so it currently resolves this route."]')).toBeNull();
    expect(container.querySelector('input[type="search"]')?.getAttribute('placeholder')).toBe('search directories');
    expect(container.querySelector('form[role="search"] h4')?.textContent).toBe('search directories');
    expect(container.querySelector('form[role="search"] button[type="submit"]')?.getAttribute('aria-label')).toBe('search directories');
  });

  it('filters directories when a tag is selected', async () => {
    render(createElement(DirectoryIndex));

    const animalsTag = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'animals');
    await act(async () => animalsTag?.click());

    const rows = container.querySelectorAll('ul[role="list"] > li');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('s/aww: Aww');
    expect(rows[1].textContent).toContain('s/cats: Cats');
    expect(container.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('animals');
  });

  it('links the eligibility action to the gold explanation', () => {
    render(createElement(DirectoryVoteNotice));

    const eligibilityLink = container.querySelector<HTMLAnchorElement>('a[href="#/gold"]');

    expect(eligibilityLink?.textContent).toBe('see how eligibility will work');
  });

  it('links an individual directory back to the directory index', () => {
    window.location.hash = '#/communities/directories/aww';
    render(createElement(Routes, null, createElement(Route, { path: '/communities/directories/:directoryCode', element: createElement(DirectoryCandidates) })));

    const backLink = container.querySelector<HTMLAnchorElement>('a[href="#/communities/directories"]');

    expect(backLink?.textContent).toContain('back to all directories');
  });

  it('searches a directory without changing candidate ranks or winner state', async () => {
    window.location.hash = '#/communities/directories/aww';
    render(createElement(Routes, null, createElement(Route, { path: '/communities/directories/:directoryCode', element: createElement(DirectoryCandidates) })));

    const searchInput = container.querySelector<HTMLInputElement>('input[type="search"]');
    expect(searchInput?.getAttribute('placeholder')).toBe('search communities in this directory');
    expect(container.querySelectorAll('[data-community-address]')).toHaveLength(2);

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(searchInput, 'wildlife');
      searchInput?.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const visibleCandidate = container.querySelector('[data-community-address]');
    expect(container.querySelectorAll('[data-community-address]')).toHaveLength(1);
    expect(visibleCandidate?.getAttribute('data-community-address')).toBe('cute-animals.bso');
    expect(visibleCandidate?.getAttribute('data-rank')).toBe('2');
    expect(visibleCandidate?.getAttribute('data-winner')).toBe('false');
  });
});
