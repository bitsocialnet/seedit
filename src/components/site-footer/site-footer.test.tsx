// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SiteFooter from './site-footer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

let root: Root;
let container: HTMLDivElement;

// the app mounts under a HashRouter, so in-app hrefs render as '#/path'
const renderFooter = () =>
  act(() => {
    root.render(createElement(HashRouter, null, createElement(SiteFooter)));
  });

describe('SiteFooter', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('renders the Seedit footer destinations without unavailable links', () => {
    renderFooter();

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    const linkDestinations = Object.fromEntries(links.map((link) => [link.textContent || link.getAttribute('aria-label'), link.href]));

    expect(linkDestinations).toMatchObject({
      blog: 'https://bitsocial.net/blog?q=seedit',
      about: 'https://bitsocial.net/projects/seedit',
      docs: 'https://bitsocial.net/docs',
      feedback: 'https://github.com/bitsocialnet/seedit/issues/new',
      contributors: 'https://github.com/bitsocialnet/seedit/graphs/contributors',
      seedit: 'https://bitsocial.net/projects/seedit',
      Bitsocial: 'https://bitsocial.net/',
    });
    expect(container.textContent).not.toContain('advertising');
    expect(container.textContent).not.toContain('careers');
    expect(container.textContent).not.toContain('contact us');
  });

  it('links the in-app changelog from the about column', () => {
    renderFooter();

    const changelogLink = Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).find((link) => link.textContent === 'changelog');

    expect(changelogLink?.getAttribute('href')).toBe('#/changelog');
    expect(changelogLink?.closest('section')?.querySelector('h2')?.textContent).toBe('about');
  });

  it('links seedit gold from the <3 column, like reddit premium on old.reddit', () => {
    renderFooter();

    const goldLink = Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).find((link) => link.textContent === 'seedit gold');

    expect(goldLink?.getAttribute('href')).toBe('#/gold');
    expect(goldLink?.closest('section')?.querySelector('h2')?.textContent).toBe('<3');
  });

  it('scrolls to the top when opening seedit gold from the footer', () => {
    let scrollFrame: FrameRequestCallback | undefined;
    const scrollTo = vi.fn();
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      scrollFrame = callback;
      return 1;
    });
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    renderFooter();

    const goldLink = Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).find((link) => link.textContent === 'seedit gold');

    act(() => goldLink?.click());

    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => scrollFrame?.(0));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it('uses the 5chan-style FOSS attribution and Bitsocial logo treatment', () => {
    renderFooter();

    expect(container.textContent).toContain('Seedit is FOSS under GPL-3.0-or-later. Powered by Bitsocial');

    const bitsocialLink = container.querySelector<HTMLAnchorElement>('a[aria-label="Bitsocial"]');
    const logo = bitsocialLink?.querySelector('img');

    expect(bitsocialLink?.textContent).toBe('');
    expect(logo?.getAttribute('src')).toBe('assets/logo/bitsocial.svg');
    expect(logo?.getAttribute('width')).toBe('18');
    expect(logo?.getAttribute('height')).toBe('18');
  });

  it('opens every external destination safely', () => {
    renderFooter();

    for (const link of container.querySelectorAll('a')) {
      // the seedit gold link is an in-app route, so it stays in the current tab
      if (link.getAttribute('href')?.startsWith('#')) {
        expect(link.getAttribute('target')).toBe(null);
        continue;
      }
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });
});
