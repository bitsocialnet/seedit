// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModernMod from './modern-mod';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({ modFeed: {} as Record<string, unknown> }));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => createElement('a', { href: to }, children),
  Navigate: ({ to }: { to: string }) => createElement('div', { 'data-redirect': to }),
}));
vi.mock('../../hooks/use-mod-feed', () => ({ default: () => testState.modFeed }));
vi.mock('../../components/modern-feed', () => ({
  default: ({ basePath, communityAddresses }: { basePath: string; communityAddresses: string[] }) =>
    createElement('div', { 'data-feed': basePath }, communityAddresses.join(',')),
  ModernFeedHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
vi.mock('../../components/modern-layout', () => ({
  ModernColumns: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  modernStyles: {},
}));

let container: HTMLDivElement;
let root: Root;

describe('ModernMod', () => {
  beforeEach(() => {
    testState.modFeed = { feed: [], hasMore: false, communityAddresses: [], sortType: 'hot', redirectPath: undefined };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('says so when the account moderates no community, instead of an endless empty feed', async () => {
    await act(async () => root.render(createElement(ModernMod)));
    expect(container.textContent).toContain('not_moderator');
    expect(container.querySelector('[data-feed]')).toBeNull();
  });

  it('shows the feed of the moderated communities under s/mod', async () => {
    testState.modFeed = { ...testState.modFeed, communityAddresses: ['a.bso', 'b.bso'] };
    await act(async () => root.render(createElement(ModernMod)));
    expect(container.querySelector('[data-feed="/s/mod"]')?.textContent).toBe('a.bso,b.bso');
  });

  it('follows the canonical path for a legacy sort route', async () => {
    testState.modFeed = { ...testState.modFeed, redirectPath: '/s/mod/top/all' };
    await act(async () => root.render(createElement(ModernMod)));
    expect(container.querySelector('[data-redirect]')?.getAttribute('data-redirect')).toBe('/s/mod/top/all');
  });
});
