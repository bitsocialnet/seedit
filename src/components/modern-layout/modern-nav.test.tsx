// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useModernNavStore from '../../stores/use-modern-nav-store';
import ModernNav from './modern-nav';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => ({ subscriptions: [] }),
  useAccountCommunities: () => ({ accountCommunities: {} }),
  useCommunity: () => undefined,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => createElement('a', { href: to }, children),
  useLocation: () => ({ pathname: '/' }),
}));

let container: HTMLDivElement;
let root: Root;

const collapseButton = () => container.querySelector<HTMLButtonElement>('button[aria-controls="modern-nav"]')!;

describe('ModernNav collapse', () => {
  beforeEach(() => {
    localStorage.clear();
    useModernNavStore.setState({ isCollapsed: false });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('collapses and expands the navigation, and remembers the choice', async () => {
    await act(async () => root.render(createElement(ModernNav, { isOpen: false, onClose: vi.fn() })));
    expect(collapseButton().getAttribute('aria-expanded')).toBe('true');
    expect(collapseButton().getAttribute('aria-label')).toBe('collapse_navigation');

    await act(async () => collapseButton().click());
    expect(collapseButton().getAttribute('aria-expanded')).toBe('false');
    expect(collapseButton().getAttribute('aria-label')).toBe('expand_navigation');
    expect(localStorage.getItem('modernNavCollapsed')).toBe('true');

    await act(async () => collapseButton().click());
    expect(useModernNavStore.getState().isCollapsed).toBe(false);
    expect(localStorage.getItem('modernNavCollapsed')).toBe('false');
  });
});
