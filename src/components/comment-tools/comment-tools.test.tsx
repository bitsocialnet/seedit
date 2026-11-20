// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommentTools from './comment-tools';

const testState = vi.hoisted(() => ({
  saved: false,
  saveComment: vi.fn(),
  unsaveComment: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        feature_not_available_yet: 'This feature is not available yet.',
        post_no_comments: 'comment',
      })[key] ?? key,
  }),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  createCrosspost: vi.fn(() => ({ cid: 'comment-cid', comment: {} })),
  useAccount: vi.fn(() => ({ author: { address: 'account-author' } })),
  useComment: vi.fn(),
  useCommunity: vi.fn(() => ({ roles: {} })),
  useSaveComment: vi.fn(() => ({
    saved: testState.saved,
    saveComment: testState.saveComment,
    unsaveComment: testState.unsaveComment,
  })),
}));

vi.mock('./hide-menu', () => ({ default: () => <li>hide</li> }));
vi.mock('./edit-menu', () => ({ default: () => <li>edit</li> }));
vi.mock('./mod-menu', () => ({ default: () => <li>mod</li> }));

describe('CommentTools', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderTools = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <CommentTools author={{ address: 'other-author' }} cid='comment-cid' comment={{ raw: { comment: {} } }} communityAddress='community.eth' />
        </MemoryRouter>,
      );
    });
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    testState.saved = false;
    testState.saveComment.mockReset();
    testState.unsaveComment.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('orders save before hide and crosspost after report', async () => {
    await renderTools();

    const actions = Array.from(container.querySelectorAll('li')).map((element) => element.textContent);
    expect(actions).toEqual(['comment', 'share', 'save', 'hide', 'report', 'crosspost']);
  });

  it('toggles between save and unsave actions', async () => {
    await renderTools();

    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click());
    expect(testState.saveComment).toHaveBeenCalledOnce();

    // The real hook re-renders SaveButton from its store; this mock only changes on remount.
    testState.saved = true;
    await act(async () => root.unmount());
    root = createRoot(container);
    await renderTools();
    const unsaveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'unsave');
    await act(async () => unsaveButton?.click());
    expect(testState.unsaveComment).toHaveBeenCalledOnce();
  });

  it('labels only the account post without a CID as pending, not a post that is loading or failed to load', async () => {
    const renderPostWithoutCid = (props: { index?: number; failed?: boolean }) =>
      act(async () => {
        root.render(
          <MemoryRouter>
            <CommentTools cid={undefined as unknown as string} communityAddress='community.eth' {...props} />
          </MemoryRouter>,
        );
      });
    const labels = () => Array.from(container.querySelectorAll('[class*="stamp"]')).map((element) => element.textContent);

    await renderPostWithoutCid({});
    expect(labels()).toEqual([]);

    await renderPostWithoutCid({ index: 0 });
    expect(labels()).toEqual(['pending']);

    await renderPostWithoutCid({ index: 0, failed: true });
    expect(labels()).toEqual(['failed']);
  });

  it('alerts that reporting is not available yet', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await renderTools();

    const reportButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'report');
    await act(async () => reportButton?.click());

    expect(alert).toHaveBeenCalledWith('This feature is not available yet.');
  });
});
