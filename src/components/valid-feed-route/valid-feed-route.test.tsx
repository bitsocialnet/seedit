// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ValidFeedRoute from './valid-feed-route';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const LocationProbe = () => createElement('output', null, useLocation().pathname);

let container: HTMLDivElement;
let root: Root;

const renderAt = async (path: string) => {
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(LocationProbe),
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: '/:sortType?/:timeFilterName?',
            element: createElement(ValidFeedRoute, null, createElement('main', null, 'feed')),
          }),
        ),
      ),
    );
  });
};

describe('ValidFeedRoute', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it.each(['/', '/new', '/hot/2w', '/active/3d', '/top/1w', '/topAll/all'])('renders the feed at %s', async (path) => {
    await renderAt(path);

    expect(container.querySelector('main')?.textContent).toBe('feed');
    expect(container.querySelector('h1')).toBeNull();
  });

  it.each(['/foo', '/hot/badfilter', '/top/2w', '/new/0d'])('renders not found at %s without changing the URL', async (path) => {
    await renderAt(path);

    expect(container.querySelector('main')).toBeNull();
    expect(container.querySelector('h1')?.textContent).toBe('page_not_found');
    expect(container.querySelector('output')?.textContent).toBe(path);
  });
});
