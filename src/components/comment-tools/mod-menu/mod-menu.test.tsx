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
});
