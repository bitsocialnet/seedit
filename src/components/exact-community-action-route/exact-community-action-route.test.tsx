// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExactCommunityActionRoute from './exact-community-action-route';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const DEFAULTS = {
  schemaVersion: 1,
  revision: 1,
  updatedAt: 1,
  directories: { dogs: { directoryCode: 'dogs', title: 'Dogs' }, birds: { directoryCode: 'birds', title: 'Birds' } },
};
const DOGS_LIST = { schemaVersion: 1, revision: 1, directoryCode: 'dogs', communities: [{ address: 'good-dogs.bso', addedAt: 1 }] };

let root: Root;
let container: HTMLDivElement;
let resolveDefaults: () => void;
let pathname = '';

const LocationProbe = () => {
  pathname = useLocation().pathname;
  return null;
};

const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

describe('ExactCommunityActionRoute', () => {
  beforeEach(() => {
    const defaultsReady = new Promise<void>((resolve) => (resolveDefaults = resolve));
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('-defaults.json')) return defaultsReady.then(() => ({ ok: true, status: 200, json: () => Promise.resolve(DEFAULTS) }));
        // birds is published, but its list file is not up yet
        if (url.endsWith('seedit-birds-directory.json')) return Promise.resolve({ ok: false, status: 404 });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(DOGS_LIST) });
      }),
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('holds a directory published after this build until it resolves, then redirects to its winner', async () => {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ['/s/dogs/submit'] },
          createElement(LocationProbe),
          createElement(
            Routes,
            null,
            createElement(Route, { path: '/s/:communityAddress/submit', element: createElement(ExactCommunityActionRoute, null, 'submit form') }),
          ),
        ),
      );
    });

    // nothing cached yet: no form aimed at dogs.bso while the published directories load
    expect(container.textContent).not.toContain('submit form');
    expect(pathname).toBe('/s/dogs/submit');

    resolveDefaults();
    for (let i = 0; i < 3; i++) await flush();

    expect(pathname).toBe('/s/good-dogs.bso/submit');
    expect(container.textContent).toContain('submit form');
  });

  it('shows the list error instead of a blank page when a published directory has no list yet', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    resolveDefaults();
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ['/s/birds/submit'] },
          createElement(LocationProbe),
          createElement(
            Routes,
            null,
            createElement(Route, { path: '/s/:communityAddress/submit', element: createElement(ExactCommunityActionRoute, null, 'submit form') }),
          ),
        ),
      );
    });
    for (let i = 0; i < 3; i++) await flush();

    expect(pathname).toBe('/s/birds/submit');
    expect(container.textContent).not.toContain('submit form');
    expect(container.textContent).toContain('Directory list request failed with 404');
  });
});
