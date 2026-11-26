// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModernDomain from './modern-domain';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({ domainFeed: {} as Record<string, unknown>, requestedDomain: undefined as string | undefined }));

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => createElement('div', { 'data-redirect': to }),
  useParams: () => ({ domain: 'example.com' }),
}));
vi.mock('../../hooks/use-domain-feed', () => ({
  default: (domain: string) => {
    testState.requestedDomain = domain;
    return testState.domainFeed;
  },
}));
vi.mock('../../components/modern-feed', () => ({
  default: ({ basePath }: { basePath: string }) => createElement('div', { 'data-feed': basePath }),
  ModernFeedHeader: ({ title, children }: { title: string; children: React.ReactNode }) => createElement('header', null, title, children),
}));
vi.mock('../../components/modern-layout', () => ({
  ModernColumns: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));

let container: HTMLDivElement;
let root: Root;

describe('ModernDomain', () => {
  beforeEach(() => {
    testState.domainFeed = { feed: [], hasMore: true, communityAddresses: ['a.bso'], sortType: 'hot', showNoResults: false };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('filters the feed to the route domain, with a link out to it', async () => {
    await act(async () => root.render(createElement(ModernDomain)));
    expect(testState.requestedDomain).toBe('example.com');
    expect(container.querySelector('[data-feed="/domain/example.com"]')).not.toBeNull();
    expect(container.querySelector('a[href="https://example.com"]')).not.toBeNull();
  });

  it('says no posts were found once the filtered feed has stayed empty', async () => {
    testState.domainFeed = { ...testState.domainFeed, showNoResults: true };
    await act(async () => root.render(createElement(ModernDomain)));
    expect(container.textContent).toContain('No posts found from example.com');
    expect(container.querySelector('[data-feed]')).toBeNull();
  });
});
