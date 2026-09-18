// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HashRouter } from 'react-router-dom';
import Markdown from './markdown';

const testState = vi.hoisted(() => ({
  comments: [] as Array<Record<string, any>>,
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAuthorAddress: ({ comment }: { comment?: { author?: { address?: string; shortAddress?: string } } }) => ({
    shortAuthorAddress: comment?.author?.shortAddress || comment?.author?.address,
  }),
  useComments: () => ({ comments: testState.comments }),
}));

// Translates with the real English strings, and mirrors i18next's default HTML escaping so a call that forgets
// `interpolation: { escapeValue: false }` surfaces here as `&gt;&gt;99` instead of the `>>99` a reader expects.
vi.mock('react-i18next', async () => {
  const strings = (await import('../../../public/translations/en/default.json')).default as Record<string, string>;
  const escapeValue = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;');

  return {
    useTranslation: () => ({
      t: (key: string, values?: Record<string, any>) =>
        (strings[key] ?? key).replace(/\{\{(\w+)\}\}/g, (placeholder: string, name: string) => {
          if (!(name in (values ?? {}))) return placeholder;
          const value = String(values?.[name]);
          return values?.interpolation?.escapeValue === false ? value : escapeValue(value);
        }),
    }),
  };
});

vi.mock('../info-tooltip', () => ({
  default: ({ content }: { content: string }) => <sup data-tooltip={content}>[?]</sup>,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

describe('Markdown', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    testState.comments = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders GitHub-flavored Markdown tables', async () => {
    await act(() => root.render(createElement(HashRouter, null, createElement(Markdown, { content: '| a | b |\n| - | - |\n| 1 | 2 |' }))));

    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('td')).toHaveLength(2);
  });

  it('renders 5chan number quotes as links to identifiable quoted comments', async () => {
    testState.comments = [
      {
        author: { address: 'alice.eth' },
        cid: 'quoted-cid',
        communityAddress: 'music-posting.eth',
        number: 42,
      },
    ];

    await act(() =>
      root.render(
        createElement(
          HashRouter,
          null,
          createElement(Markdown, {
            content: '>>42\nA reply',
            enableFivechanQuotes: true,
            quotedCids: ['quoted-cid'],
          }),
        ),
      ),
    );

    const link = container.querySelector('a');
    expect(link?.textContent).toBe('[quoting u/alice.bso]');
    expect(link?.getAttribute('href')).toBe('#/s/music-posting.eth/comments/quoted-cid');
    expect(container.querySelector('blockquote')).toBeNull();
    expect(container.querySelector('[data-tooltip]')).toBeNull();
  });

  it('keeps unresolved same-board and cross-board quotes understandable', async () => {
    await act(() =>
      root.render(
        createElement(
          HashRouter,
          null,
          createElement(Markdown, {
            content: '>>99\n>>>/fit/77\nReplying to both',
            enableFivechanQuotes: true,
          }),
        ),
      ),
    );

    expect(container.textContent).toContain('[quoting >>99]');
    expect(container.textContent).toContain('[quoting >>>/fit/77]');
    const tooltips = [...container.querySelectorAll('[data-tooltip]')].map((tooltip) => tooltip.getAttribute('data-tooltip'));
    expect(tooltips).toEqual([
      '>>99 is a quote style Seedit does not use, and the quoted comment could not be found.',
      '>>>/fit/77 is a quote style Seedit does not use, and the quoted comment could not be found.',
    ]);
    expect(container.querySelector('blockquote')).toBeNull();
  });

  it('drops a 5chan quote that only points at the parent rendered above the reply', async () => {
    testState.comments = [{ author: { address: 'alice.eth' }, cid: 'parent-cid', communityAddress: 'music-posting.eth', number: 88 }];

    await act(() =>
      root.render(
        createElement(
          HashRouter,
          null,
          createElement(Markdown, {
            content: '>>88\nclassic tactic',
            enableFivechanQuotes: true,
            parentNumber: 88,
            quotedCids: ['parent-cid'],
          }),
        ),
      ),
    );

    expect(container.textContent?.trim()).toBe('classic tactic');
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('[data-tooltip]')).toBeNull();
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('keeps a parent quote when the parent is not rendered above the reply', async () => {
    testState.comments = [{ author: { address: 'alice.eth' }, cid: 'parent-cid', communityAddress: 'music-posting.eth', number: 88 }];

    await act(() =>
      root.render(
        createElement(
          HashRouter,
          null,
          createElement(Markdown, {
            content: '>>88\nclassic tactic',
            enableFivechanQuotes: true,
            quotedCids: ['parent-cid'],
          }),
        ),
      ),
    );

    expect(container.querySelector('a')?.textContent).toBe('[quoting u/alice.bso]');
    expect(container.querySelector('[data-tooltip]')).toBeNull();
  });

  it('keeps a parent quote that appears next to other quotes', async () => {
    testState.comments = [
      { author: { address: 'alice.eth' }, cid: 'parent-cid', communityAddress: 'music-posting.eth', number: 88 },
      { author: { address: 'bob.eth' }, cid: 'other-cid', communityAddress: 'music-posting.eth', number: 42 },
    ];

    await act(() =>
      root.render(
        createElement(
          HashRouter,
          null,
          createElement(Markdown, {
            content: '>>88\n>>42\nreplying to both',
            enableFivechanQuotes: true,
            parentNumber: 88,
            quotedCids: ['parent-cid', 'other-cid'],
          }),
        ),
      ),
    );

    const links = [...container.querySelectorAll('a')].map((link) => link.textContent);
    expect(links).toEqual(['[quoting u/alice.bso]', '[quoting u/bob.bso]']);
    expect(container.querySelector('[data-tooltip]')).toBeNull();
  });

  it('preserves regular Markdown quotes and code containing 5chan-shaped text', async () => {
    await act(() =>
      root.render(
        createElement(
          HashRouter,
          null,
          createElement(Markdown, {
            content: '> quoted text\n\n```text\n>>42\n```',
            enableFivechanQuotes: true,
          }),
        ),
      ),
    );

    expect(container.querySelector('blockquote')?.textContent).toContain('quoted text');
    expect(container.querySelector('code')?.textContent).toContain('>>42');
    expect(container.querySelector('[data-tooltip]')).toBeNull();
  });

  it('does not reinterpret 5chan-shaped text without the numbered-comment signal', async () => {
    await act(() => root.render(createElement(HashRouter, null, createElement(Markdown, { content: '>>42\n\n[ordinary link](/__seedit-fivechan-quote/42)' }))));

    expect(container.querySelectorAll('blockquote')).toHaveLength(2);
    expect(container.querySelector('[data-tooltip]')).toBeNull();
    expect(container.querySelector('a')?.textContent).toBe('ordinary link');
  });
});
