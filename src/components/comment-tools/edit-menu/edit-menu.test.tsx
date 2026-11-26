// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EditMenu from './edit-menu';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  comment: undefined as Record<string, any> | undefined,
  publishedOptions: [] as Record<string, any>[],
  // the first publishes reject before the edit is stored, like a community whose challenge settings time out
  failingPublishes: 0,
}));

vi.mock('@bitsocial/bitsocial-react-hooks', async () => {
  const { useMemo, useState } = await import('react');
  return {
    useComment: () => testState.comment,
    useEditedComment: () => ({ editedComment: undefined }),
    // like the hooks, a rejected publish is caught, stored in the errors state and passed to onError,
    // and publishCommentEdit is a new function whenever the errors or the options change
    usePublishCommentEdit: (options: Record<string, any>) => {
      const [errors, setErrors] = useState<Error[]>([]);
      return useMemo(
        () => ({
          errors,
          publishCommentEdit: async () => {
            testState.publishedOptions.push(options);
            if (testState.failingPublishes > 0) {
              testState.failingPublishes--;
              const error = new Error('timed out loading challenge settings');
              setErrors((previous) => [...previous, error]);
              options.onError?.(error);
            }
          },
        }),
        [errors, options],
      );
    },
  };
});
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

let container: HTMLDivElement;
let root: Root;

const clickText = (text: string) => act(async () => (Array.from(container.querySelectorAll('span')).find((span) => span.textContent === text) as HTMLElement).click());

describe('EditMenu', () => {
  beforeEach(async () => {
    testState.comment = { cid: 'comment-cid', communityAddress: 'example.bso', deleted: false };
    testState.publishedOptions = [];
    testState.failingPublishes = 0;
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(createElement(EditMenu, { commentCid: 'comment-cid' })));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('publishes the delete once when the user confirms', async () => {
    await clickText('delete');
    await clickText('yes');

    expect(testState.publishedOptions).toHaveLength(1);
    expect(testState.publishedOptions[0]).toMatchObject({ commentCid: 'comment-cid', communityAddress: 'example.bso', deleted: true });
  });

  it('does not publish the delete again after it fails', async () => {
    testState.failingPublishes = 3;
    await clickText('delete');
    await clickText('yes');
    await act(async () => {});

    expect(testState.publishedOptions).toHaveLength(1);
    expect(window.alert).toHaveBeenCalledExactlyOnceWith('Comment edit failed. timed out loading challenge settings');
  });
});
