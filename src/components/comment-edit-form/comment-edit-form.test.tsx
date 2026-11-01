// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommentEditForm from './comment-edit-form';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const testState = vi.hoisted(() => ({
  comment: { cid: 'comment-cid', content: 'Original text', reason: 'old reason', spoiler: false, nsfw: false } as Record<string, unknown>,
  publishedOptions: [] as Record<string, unknown>[],
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useComment: () => testState.comment,
  useEditedComment: () => ({ editedComment: undefined }),
  // like the real hook, publishCommentEdit publishes the options of the render it came from
  usePublishCommentEdit: (options: Record<string, unknown>) => ({ publishCommentEdit: () => testState.publishedOptions.push(options) }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../reply-form', () => ({ FormattingHelpTable: () => null }));
vi.mock('../comment-form', () => ({ default: {} }));
vi.mock('../markdown', () => ({ default: () => null }));
vi.mock('../../lib/utils/challenge-utils', () => ({ alertChallengeVerificationFailed: vi.fn() }));
vi.mock('../../lib/utils/comment-utils', () => ({ getCommentCommunityAddress: () => 'example.bso' }));
vi.mock('../../stores/use-challenges-store', () => ({ default: { getState: () => ({ addChallenge: vi.fn() }) } }));

let container: HTMLDivElement;
let root: Root;

const typeContent = async (value: string) => {
  const textarea = container.querySelector('textarea')!;
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  await act(async () => {
    setValue.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const clickSave = async () => {
  const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'save')!;
  await act(async () => saveButton.click());
};

describe('CommentEditForm', () => {
  beforeEach(() => {
    testState.publishedOptions = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('publishes on save with a trailing "edit:" line parsed into the edit reason', async () => {
    const hideCommentEditForm = vi.fn();
    await act(async () => root.render(createElement(CommentEditForm, { commentCid: 'comment-cid', hideCommentEditForm })));

    await typeContent('Updated text\nedit: typo fix');
    await clickSave();

    expect(testState.publishedOptions).toHaveLength(1);
    expect(testState.publishedOptions[0]).toMatchObject({ commentCid: 'comment-cid', content: 'Updated text', reason: 'typo fix' });
    expect(hideCommentEditForm).toHaveBeenCalledTimes(1);
  });

  it('keeps the edit reason and strips the "edit:" line from the textarea when the form stays open', async () => {
    await act(async () => root.render(createElement(CommentEditForm, { commentCid: 'comment-cid' })));

    await typeContent('Updated text');
    await clickSave();
    expect(testState.publishedOptions[0]).toMatchObject({ content: 'Updated text', reason: 'old reason' });

    await typeContent('Second edit\nEDIT: clarified');
    await clickSave();
    expect(testState.publishedOptions[1]).toMatchObject({ content: 'Second edit', reason: 'clarified' });
    expect(container.querySelector('textarea')?.value).toBe('Second edit');
  });
});
