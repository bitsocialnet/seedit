// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CrosspostPreview from './crosspost-preview';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const baseSource = {
  author: { address: 'source-author.eth', displayName: 'Source author', nameResolved: false },
  cid: 'source-cid',
  communityAddress: 'source-community.eth',
  content: 'A compact source excerpt',
  downvoteCount: 2,
  isCommunityVerified: false,
  replyCount: 4,
  signature: { publicKey: 'source-public-key' },
  state: 'succeeded',
  timestamp: Math.floor(Date.now() / 1000) - 3600,
  title: 'Source post',
  upvoteCount: 9,
};

const testState = vi.hoisted(() => ({
  source: {} as Record<string, any>,
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useCrosspost: () => testState.source,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: { children?: React.ReactNode; to: string }) => createElement('a', { ...props, href: props.to }, children),
  useParams: () => ({}),
}));

vi.mock('../../lib/utils/media-utils', () => ({
  getCommentMediaInfo: ({ link }: { link?: string }) => {
    if (!link) return undefined;
    if (link.endsWith('.jpg')) return { type: 'image', url: link };
    if (link.includes('youtube.com')) return { type: 'iframe', url: link };
    return { type: 'webpage', url: link };
  },
}));

vi.mock('../embed', () => ({
  default: ({ url }: { url: string }) => createElement('div', { 'data-testid': 'embed', 'data-url': url }),
}));

let container: HTMLDivElement;
let root: Root;

describe('CrosspostPreview', () => {
  beforeEach(() => {
    testState.source = { ...baseSource, author: { ...baseSource.author }, signature: { ...baseSource.signature } };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderPreview = async () => {
    await act(async () => {
      root.render(createElement(CrosspostPreview, { crosspost: { cid: 'source-cid', comment: {} } }));
    });
  };

  it('renders old Reddit metadata without an inner thumbnail or unverified community origin', async () => {
    await renderPreview();

    expect(container.textContent).toContain('Source post');
    expect(container.textContent).toContain('7 points');
    expect(container.textContent).toContain('4 post_comments');
    expect(container.textContent).toContain('Source author');
    expect(container.textContent).not.toContain('source-community.eth');
    expect(container.textContent).toContain('•');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('links to the source after its community update is loaded', async () => {
    testState.source = { ...testState.source, isCommunityVerified: true };
    await renderPreview();

    const links = Array.from(container.querySelectorAll('a'));
    expect(container.textContent).toContain('s/source-community.bso');
    expect(links.some((link) => link.getAttribute('href')?.includes('source-community.eth') && link.getAttribute('href')?.includes('source-cid'))).toBe(true);
  });

  it('uses the derived author address instead of a signing public key', async () => {
    testState.source = {
      ...testState.source,
      author: { address: 'LeJuiWwdmhQE', nameResolved: false },
      signature: { publicKey: 'QcKWVClmXHCg' },
    };
    await renderPreview();

    expect(container.textContent).toContain('LeJuiWwdmhQE');
    expect(container.textContent).not.toContain('QcKWVClmXHCg');
  });

  it('renders selftext and direct image media inside the preview', async () => {
    testState.source = { ...testState.source, link: 'https://example.com/source.jpg' };
    await renderPreview();

    expect(container.querySelector('img[src="https://example.com/source.jpg"]')).not.toBeNull();
    expect(container.textContent).toContain('A compact source excerpt');
  });

  it('hides failed media while preserving the source selftext', async () => {
    testState.source = { ...testState.source, link: 'https://example.com/missing.jpg' };
    await renderPreview();

    const image = container.querySelector('img[src="https://example.com/missing.jpg"]') as HTMLImageElement;
    await act(async () => {
      image.dispatchEvent(new Event('error'));
    });

    expect(container.querySelector('img[src="https://example.com/missing.jpg"]')).toBeNull();
    expect(container.textContent).toContain('A compact source excerpt');
  });

  it('renders supported embeds inside the media treatment', async () => {
    testState.source = { ...testState.source, content: undefined, link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };
    await renderPreview();

    expect(container.querySelector('[data-testid="embed"]')?.getAttribute('data-url')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});
