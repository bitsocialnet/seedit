// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModernCommentMenu, { ModernEditForm } from './modern-comment-menu';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  roles: {} as Record<string, { role: string }>,
  toggleDeleted: vi.fn(),
  saveModeration: vi.fn().mockResolvedValue(true),
  setFlag: vi.fn(),
  update: vi.fn(),
  saveEdit: vi.fn(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => ({ author: { address: 'me' } }),
  useCommunity: () => ({ roles: testState.roles }),
  useSaveComment: () => ({ saved: false, saveComment: vi.fn(), unsaveComment: vi.fn() }),
  useBlock: () => ({ blocked: false, block: vi.fn(), unblock: vi.fn() }),
}));
vi.mock('react-i18next', () => ({ Trans: () => null, useTranslation: () => ({ t: (key: string) => key }) }));
// The menu library's own behavior is not under test: every item renders, and selecting one calls onSelect.
vi.mock('@ui-sdk/react/menu', () => ({
  Menu: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  MenuTrigger: ({ children, ...props }: { children: React.ReactNode }) => createElement('button', props, children),
  MenuContent: ({ children }: { children: React.ReactNode }) => createElement('div', { role: 'menu' }, children),
  MenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) => createElement('button', { role: 'menuitem', onClick: onSelect }, children),
  MenuSeparator: () => createElement('hr'),
}));
vi.mock('../../hooks/use-delete-comment', () => ({ default: () => ({ deleted: false, toggleDeleted: testState.toggleDeleted }) }));
vi.mock('../../hooks/use-comment-moderation', () => ({
  default: () => ({
    post: { parentCid: undefined },
    moderation: { removed: false },
    banDays: 1,
    setFlag: testState.setFlag,
    setBanned: vi.fn(),
    setBanDays: vi.fn(),
    setReason: vi.fn(),
    save: testState.saveModeration,
  }),
}));
vi.mock('../../hooks/use-comment-edit', () => ({
  default: () => ({ options: { content: 'old text' }, update: testState.update, save: testState.saveEdit }),
}));
vi.mock('../../hooks/use-community-identifier', () => ({ getCommunityIdentifier: (address: string) => ({ name: address }) }));
vi.mock('../modern-layout', () => ({ modernStyles: {} }));

let container: HTMLDivElement;
let root: Root;

const items = () => Array.from(container.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent);
const item = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((element) => element.textContent?.startsWith(label))!;
const render = (element: React.ReactElement) => act(async () => root.render(element));

describe('ModernCommentMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.roles = {};
    // jsdom lacks modal dialogs; opening one only needs to mark it open.
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("offers another author's comment saving, hiding, and blocking only", async () => {
    await render(
      createElement(ModernCommentMenu, {
        comment: { cid: 'c', communityAddress: 'example.bso', author: { address: 'them', shortAddress: 'them' } },
        onEdit: vi.fn(),
        className: '',
      }),
    );
    expect(items()).toEqual(['save', 'hide', 'block u/them', 'block s/example.bso']);
  });

  it("offers the author's own comment editing and a confirmed delete", async () => {
    const onEdit = vi.fn();
    await render(createElement(ModernCommentMenu, { comment: { cid: 'c', communityAddress: 'example.bso', author: { address: 'me' } }, onEdit, className: '' }));
    expect(items()).toEqual(['save', 'hide', 'block s/example.bso', 'edit', 'delete']);

    await act(async () => item('edit').click());
    expect(onEdit).toHaveBeenCalledTimes(1);

    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await act(async () => item('delete').click());
    expect(testState.toggleDeleted).not.toHaveBeenCalled();
    await act(async () => item('delete').click());
    expect(testState.toggleDeleted).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it('lets a moderator open the moderation dialog and publish it', async () => {
    testState.roles = { me: { role: 'moderator' } };
    await render(createElement(ModernCommentMenu, { comment: { cid: 'c', communityAddress: 'example.bso', author: { address: 'them' } }, className: '' }));
    expect(items()).toContain('moderation');

    await act(async () => item('moderation').click());
    const dialog = container.querySelector('dialog')!;
    expect(dialog.open).toBe(true);

    const removed = Array.from(dialog.querySelectorAll('label'))
      .find((label) => label.textContent === 'removed')!
      .querySelector('input')!;
    await act(async () => removed.click());
    expect(testState.setFlag).toHaveBeenCalledWith('removed', true);

    await act(async () => dialog.querySelector('form')!.requestSubmit());
    expect(testState.saveModeration).toHaveBeenCalledTimes(1);
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('shows nothing for a comment still publishing', async () => {
    await render(createElement(ModernCommentMenu, { comment: { author: { address: 'me' } }, className: '' }));
    expect(container.innerHTML).toBe('');
  });
});

describe('ModernEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('saves the edit and closes, or closes without saving on cancel', async () => {
    const onClose = vi.fn();
    await render(createElement(ModernEditForm, { cid: 'c', onClose }));
    expect(container.querySelector('textarea')?.value).toBe('old text');

    await act(async () => container.querySelector('form')!.requestSubmit());
    expect(testState.saveEdit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => container.querySelector<HTMLButtonElement>('button[type="button"]')!.click());
    expect(testState.saveEdit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
