// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModMenu from './mod-menu';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  comment: undefined as Record<string, any> | undefined,
  lastOptions: undefined as Record<string, any> | undefined,
  publishedOptions: [] as Record<string, any>[],
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useComment: () => testState.comment,
  useEditedComment: () => ({ editedComment: undefined }),
  // like the hooks, publishCommentModeration publishes the options of the render that returned it
  usePublishCommentModeration: (options: Record<string, any>) => {
    testState.lastOptions = options;
    return { publishCommentModeration: async () => testState.publishedOptions.push(options) };
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }), Trans: () => null }));

let container: HTMLDivElement;
let root: Root;

const render = () => act(async () => root.render(createElement(ModMenu, { cid: 'comment-cid' })));
const checkbox = (id: string) => container.querySelector<HTMLInputElement>(`#${id}`)!;

describe('ModMenu', () => {
  beforeEach(() => {
    testState.comment = { cid: 'comment-cid', communityAddress: 'example.bso', pinned: false, locked: false, spoiler: false };
    testState.lastOptions = undefined;
    testState.publishedOptions = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('starts from the comment flags at the time the menu is opened', async () => {
    await render();

    // the comment updates after the menu mounted with the feed, before the moderator opens it
    testState.comment = { ...testState.comment, pinned: true, locked: true };
    await render();

    await act(async () => (Array.from(container.querySelectorAll('span')).find((span) => span.textContent === 'moderation') as HTMLElement).click());
    expect(checkbox('pinned').checked).toBe(true);
    expect(checkbox('locked').checked).toBe(true);

    await act(async () => checkbox('spoiler').click());
    await act(async () => (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'save') as HTMLElement).click());

    expect(testState.publishedOptions).toHaveLength(1);
    expect(testState.publishedOptions[0].commentModeration).toMatchObject({ pinned: true, locked: true, spoiler: true });
  });

  describe('ban', () => {
    const now = Math.floor(new Date('2026-03-08T00:00:00Z').getTime() / 1000);
    const day = 24 * 60 * 60;
    const open = () => act(async () => (Array.from(container.querySelectorAll('span')).find((span) => span.textContent === 'moderation') as HTMLElement).click());
    const save = () => act(async () => (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'save') as HTMLElement).click());
    const published = () => testState.publishedOptions[0].commentModeration;

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-03-08T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('bans through commentModeration.author, the field pkc-js reads', async () => {
      await render();
      await open();
      await act(async () => checkbox('banUser').click());
      await save();

      expect(published().author).toEqual({ banExpiresAt: now + day });
      expect(published()).not.toHaveProperty('banExpiresAt');
    });

    it('does not pre-fill or send the author-wide ban when moderating another comment by a banned author', async () => {
      testState.comment = { ...testState.comment, author: { address: 'author.bso', community: { banExpiresAt: now + 3 * day } } };
      await render();
      await open();
      expect(checkbox('banUser').checked).toBe(false);

      await act(async () => checkbox('removed').click());
      await save();

      expect(published()).toMatchObject({ removed: true });
      expect(published()).not.toHaveProperty('author');
    });

    it('pre-fills a running ban from this comment and does not republish it unchanged', async () => {
      testState.comment = { ...testState.comment, authorBanExpiresAt: now + 3 * day };
      await render();
      await open();
      expect(checkbox('banUser').checked).toBe(true);

      await act(async () => checkbox('removed').click());
      await save();

      expect(published()).not.toHaveProperty('author');
    });

    it('lifts a running ban from this comment with the current time when it is unchecked', async () => {
      testState.comment = { ...testState.comment, authorBanExpiresAt: now + 3 * day };
      await render();
      await open();
      await act(async () => checkbox('banUser').click());
      await save();

      expect(published().author).toEqual({ banExpiresAt: now });
    });

    it('does not pre-fill a ban from this comment that already ended', async () => {
      testState.comment = { ...testState.comment, authorBanExpiresAt: now - day };
      await render();
      await open();

      expect(checkbox('banUser').checked).toBe(false);
    });

    it('does not resend the ban the menu opened with after it changes while the menu is open', async () => {
      testState.comment = { ...testState.comment, authorBanExpiresAt: now + 3 * day };
      await render();
      await open();
      testState.comment = { ...testState.comment, authorBanExpiresAt: now + 10 * day };
      await render();
      await act(async () => checkbox('removed').click());
      await save();

      expect(published()).not.toHaveProperty('author');
    });
  });
});
