// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModernAbout from './modern-about';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  location: { pathname: '/about', search: '', hash: '' },
  params: {} as Record<string, string>,
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({ useCommunity: () => ({ title: 'Example' }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => createElement('a', { href: to }, children),
  Navigate: ({ to }: { to: string }) => createElement('div', { 'data-redirect': to }),
  useLocation: () => testState.location,
  useParams: () => testState.params,
}));
vi.mock('../../hooks/use-resolved-community-route', () => ({ default: () => ({ communityAddress: testState.params.communityAddress }) }));
vi.mock('../../components/faq', () => ({ default: () => createElement('div', { 'data-faq': true }) }));
vi.mock('../../components/modern-community-about', () => ({
  default: ({ communityAddress }: { communityAddress: string }) => createElement('aside', { 'data-community': communityAddress }),
}));
vi.mock('../../components/modern-layout', () => ({
  ModernColumns: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));

let container: HTMLDivElement;
let root: Root;

const render = async (pathname: string, params: Record<string, string> = {}, search = '') => {
  testState.location = { pathname, search, hash: '' };
  testState.params = params;
  await act(async () => root.render(createElement(ModernAbout, { key: pathname })));
};
const redirect = () => container.querySelector('[data-redirect]')?.getAttribute('data-redirect');

describe('ModernAbout', () => {
  beforeEach(() => {
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

  it('explains Seedit on /about, and shows a community about card on its about route', async () => {
    await render('/about');
    expect(container.querySelector('[data-faq]')).not.toBeNull();
    expect(container.querySelector('a[href="/changelog"]')).not.toBeNull();

    await render('/s/example.bso/about', { communityAddress: 'example.bso' });
    expect(container.querySelector('[data-community="example.bso"]')).not.toBeNull();
  });

  it('leads the about routes that only showed the old phone sidebar to their pages, keeping the query', async () => {
    await render('/profile/about', {}, '?x=1');
    expect(redirect()).toBe('/profile?x=1');

    await render('/u/alice.bso/comments/cid/about', { authorAddress: 'alice.bso', commentCid: 'cid' });
    expect(redirect()).toBe('/u/alice.bso/comments/cid');

    await render('/s/example.bso/comments/cid/about', { communityAddress: 'example.bso', commentCid: 'cid' });
    expect(redirect()).toBe('/s/example.bso/about');

    await render('/communities/directories/memes/about', { directoryCode: 'memes' });
    expect(redirect()).toBe('/communities/directories/memes');

    await render('/communities/directories/about');
    expect(redirect()).toBe('/communities/directories');
  });
});
