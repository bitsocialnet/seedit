// @vitest-environment jsdom

import * as React from 'react';
import { createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HashRouter, useNavigate, type NavigateFunction, type NavigateOptions } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebAnalytics from './web-analytics';
import { trackPageView } from '../../lib/analytics';

vi.mock('../../lib/analytics', () => ({ trackPageView: vi.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

let navigate: NavigateFunction;
let root: Root;
let container: HTMLDivElement;
const Harness = () => {
  navigate = useNavigate();
  return createElement(WebAnalytics);
};
const render = () => act(() => root.render(createElement(StrictMode, null, createElement(HashRouter, null, createElement(Harness)))));
const go = (to: string, options?: NavigateOptions) =>
  act(async () => {
    await navigate(to, options);
  });
const goBack = () =>
  act(async () => {
    const popped = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));
    void navigate(-1);
    await popped;
  });
const trackedPaths = () => vi.mocked(trackPageView).mock.calls.map(([path]) => path);

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/#/');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('hash route pageviews', () => {
  it('tracks the landing route only once in StrictMode and ignores unrelated renders', async () => {
    await render();
    await render();
    expect(trackPageView).toHaveBeenCalledExactlyOnceWith('/', { replace: false });
  });

  it('tracks feed, post and distinct post navigation while ignoring search and anchor-only changes', async () => {
    await render();
    await go('/s/memes');
    await go('/s/memes/comments/first');
    await go('/s/memes/comments/second');
    await go('/s/memes/comments/second?context=3');
    await go('/s/memes/comments/second?context=3#reply');
    expect(trackedPaths()).toEqual(['/', '/s/memes', '/s/memes/comments/first', '/s/memes/comments/second']);
  });

  it('marks navigations that replace the entry, so a redirect to the same page counts once', async () => {
    await render();
    await go('/hot', { replace: true });
    await go('/s/memes');
    expect(vi.mocked(trackPageView).mock.calls).toEqual([
      ['/', { replace: false }],
      ['/hot', { replace: true }],
      ['/s/memes', { replace: false }],
    ]);
  });

  it('records browser back navigation', async () => {
    await render();
    await go('/s/memes');
    await go('/s/memes/about');
    await goBack();
    expect(trackedPaths()).toEqual(['/', '/s/memes', '/s/memes/about', '/s/memes']);
  });

  it('sends neither the pending page nor its redirect to the accepted post', async () => {
    await render();
    await go('/s/memes/submit');
    await go('/profile/7');
    await go('/s/memes-posting.bso/comments/new-cid', { replace: true });
    await go('/s/memes');
    expect(trackedPaths()).toEqual(['/', '/s/memes/submit', '/s/memes']);
  });

  it('sends no view of the submit page the poster returns to after cancelling the challenge', async () => {
    await render();
    await go('/s/memes/submit');
    await go('/profile/7');
    await goBack();
    await go('/s/memes');
    expect(trackedPaths()).toEqual(['/', '/s/memes/submit', '/s/memes']);
  });

  it('still tracks the profile pages that are not pending posts', async () => {
    await render();
    await go('/profile');
    await go('/profile/submitted');
    await go('/profile/about');
    expect(trackedPaths()).toEqual(['/', '/profile', '/profile/submitted', '/profile/about']);
  });
});
