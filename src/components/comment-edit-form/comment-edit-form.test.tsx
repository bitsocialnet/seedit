// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommentEditForm from './comment-edit-form';
import useCommentEditDraftStore from '../../stores/use-comment-edit-draft-store';

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

// like post.tsx and reply.tsx: hideCommentEditForm unmounts the form, and the edit menu mounts a new one
const renderForm = async (hideCommentEditForm?: () => void) => {
  await act(async () => root.render(createElement(CommentEditForm, { commentCid: 'comment-cid', hideCommentEditForm })));
};
const unmountForm = async () => {
  await act(async () => root.render(null));
};

describe('CommentEditForm', () => {
  beforeEach(() => {
    testState.comment = { cid: 'comment-cid', content: 'Original text', reason: 'old reason', spoiler: false, nsfw: false };
    testState.publishedOptions = [];
    useCommentEditDraftStore.setState({ drafts: {} });
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

  it('reopens with the saved text while the edit is not accepted, also after it failed', async () => {
    await renderForm(vi.fn());
    await typeContent('Updated text\nedit: typo fix');
    await clickSave();
    await unmountForm();

    // abandoned or still pending: no verification arrived
    await renderForm();
    expect(container.querySelector('textarea')?.value).toBe('Updated text');
    await unmountForm();

    // the community never answered: the hooks roll the stored edit back, so the comment shows the old text again
    const failedEdit = testState.publishedOptions[0] as { onError: (error: Error) => void };
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    failedEdit.onError(new Error('no response from the community'));
    expect(alert).toHaveBeenCalledWith('no response from the community');
    consoleWarn.mockRestore();
    alert.mockRestore();

    await renderForm();
    expect(container.querySelector('textarea')?.value).toBe('Updated text');
    await clickSave();
    expect(testState.publishedOptions[1]).toMatchObject({ content: 'Updated text', reason: 'typo fix' });
  });

  it('retries a failed edit unchanged when its text ended with two "edit:" lines', async () => {
    await renderForm(vi.fn());
    await typeContent('Body text\nedit: kept in the body\nedit: the reason');
    await clickSave();
    await unmountForm();
    expect(testState.publishedOptions[0]).toMatchObject({ content: 'Body text\nedit: kept in the body', reason: 'the reason' });

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    (testState.publishedOptions[0] as { onError: (error: Error) => void }).onError(new Error('no response from the community'));
    consoleWarn.mockRestore();
    alert.mockRestore();

    await renderForm();
    expect(container.querySelector('textarea')?.value).toBe('Body text\nedit: kept in the body');
    await clickSave();
    expect(testState.publishedOptions[1]).toMatchObject({ content: 'Body text\nedit: kept in the body', reason: 'the reason' });
  });

  it('starts from the comment again once the community accepted the edit', async () => {
    await renderForm(vi.fn());
    await typeContent('Accepted text');
    await clickSave();
    await unmountForm();

    const acceptedEdit = testState.publishedOptions[0] as { onChallengeVerification: (challengeVerification: unknown, commentEdit: unknown) => void };
    acceptedEdit.onChallengeVerification({ challengeSuccess: true }, {});
    testState.comment = { ...testState.comment, content: 'Accepted text, as the community stored it' };

    await renderForm();
    expect(container.querySelector('textarea')?.value).toBe('Accepted text, as the community stored it');
  });

  it('keeps a newer saved text when an older edit is accepted', async () => {
    await renderForm(vi.fn());
    await typeContent('First save');
    await clickSave();
    await unmountForm();
    await renderForm(vi.fn());
    await typeContent('Second save');
    await clickSave();
    await unmountForm();

    const firstEdit = testState.publishedOptions[0] as { onChallengeVerification: (challengeVerification: unknown, commentEdit: unknown) => void };
    firstEdit.onChallengeVerification({ challengeSuccess: true }, {});

    await renderForm();
    expect(container.querySelector('textarea')?.value).toBe('Second save');
  });
});
