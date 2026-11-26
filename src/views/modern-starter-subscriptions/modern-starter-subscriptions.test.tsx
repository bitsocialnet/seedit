// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModernStarterSubscriptions from './modern-starter-subscriptions';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  state: {} as Record<string, any>,
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => createElement('a', { href: to, className }, children),
}));
vi.mock('../../hooks/use-starter-subscriptions', () => ({ useStarterSubscriptions: () => testState.state }));
vi.mock('../../components/modern-community-avatar', () => ({ default: () => null }));
vi.mock('../../components/modern-layout', () => ({
  ModernColumns: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  modernStyles: {},
}));

let container: HTMLDivElement;
let root: Root;

const checkbox = (address: string) =>
  Array.from(container.querySelectorAll('label'))
    .find((label) => label.textContent?.includes(address))!
    .querySelector('input') as HTMLInputElement;
const getButton = (text: string) => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === text)!;

describe('ModernStarterSubscriptions', () => {
  beforeEach(() => {
    testState.state = {
      list: {
        revision: 2,
        communities: [
          { address: 'joined.bso', title: 'Joined' },
          { address: 'added.bso', title: 'Added' },
          { address: 'other.bso', title: 'Other' },
        ],
      },
      subscriptions: ['joined.bso'],
      delta: { addedAddresses: ['added.bso'], removedAddresses: ['gone.bso'] },
      loading: false,
      saving: false,
      canReview: true,
      addSelected: vi.fn().mockResolvedValue(undefined),
      keepCurrent: vi.fn().mockResolvedValue(undefined),
      replacePrevious: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal('scrollTo', vi.fn());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('preselects the new default communities and adds what is selected', async () => {
    await act(async () => root.render(createElement(ModernStarterSubscriptions)));

    expect(checkbox('joined.bso').checked).toBe(true);
    expect(checkbox('joined.bso').disabled).toBe(true);
    expect(checkbox('added.bso').checked).toBe(true);
    expect(checkbox('other.bso').checked).toBe(false);
    expect(container.textContent).toContain('s/gone.bso');

    await act(async () => checkbox('other.bso').click());
    await act(async () => checkbox('added.bso').click());
    await act(async () => getButton('add_selected_communities').click());
    expect(testState.state.addSelected).toHaveBeenCalledWith(['other.bso']);
  });

  it('waits for the current list before offering any choice', async () => {
    testState.state.canReview = false;
    await act(async () => root.render(createElement(ModernStarterSubscriptions)));
    for (const label of ['add_selected_communities', 'keep_current_subscriptions', 'use_latest_starter_set']) {
      expect(getButton(label).disabled).toBe(true);
    }
  });
});
