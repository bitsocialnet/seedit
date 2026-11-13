// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_UI_MODE } from '../lib/utils/ui-mode-utils';

const loadStore = async () => (await import('./use-ui-mode-store')).default;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('useUiModeStore', () => {
  it('uses the default interface until one is chosen', async () => {
    const store = await loadStore();
    expect(store.getState().uiMode).toBe(DEFAULT_UI_MODE);
    expect(localStorage.getItem('uiMode')).toBeNull();
  });

  it('keeps a stored choice and ignores an invalid one', async () => {
    localStorage.setItem('uiMode', 'old');
    expect((await loadStore()).getState().uiMode).toBe('old');

    vi.resetModules();
    localStorage.setItem('uiMode', 'classic');
    expect((await loadStore()).getState().uiMode).toBe(DEFAULT_UI_MODE);
  });

  it('applies ?ui= once, stores it, and removes only that parameter from the address', async () => {
    window.history.replaceState(null, '', '/?lng=de&ui=old#/s/all/top');
    const store = await loadStore();

    expect(store.getState().uiMode).toBe('old');
    expect(localStorage.getItem('uiMode')).toBe('old');
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/?lng=de#/s/all/top');
  });

  it('stores a choice made in the app', async () => {
    const store = await loadStore();
    store.getState().setUiMode('old');

    expect(store.getState().uiMode).toBe('old');
    expect(localStorage.getItem('uiMode')).toBe('old');
  });
});
