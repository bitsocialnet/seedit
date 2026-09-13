// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import useDisplayedSubscriptions from './use-displayed-subscriptions';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

let container: HTMLDivElement;
let root: Root;
let hookResult: ReturnType<typeof useDisplayedSubscriptions>;
let renderCount = 0;

const HookHarness = ({ currentList, resetKey }: { currentList: string[]; resetKey: string }) => {
  renderCount += 1;
  hookResult = useDisplayedSubscriptions(() => currentList, [resetKey]);
  return null;
};

describe('useDisplayedSubscriptions', () => {
  beforeEach(() => {
    renderCount = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps the mounted snapshot while the current list changes and marks unsubscribed addresses in place', async () => {
    await act(() => root.render(createElement(HookHarness, { currentList: ['a.bso', 'b.bso'], resetKey: 'account-1' })));
    expect(hookResult.list).toEqual(['a.bso', 'b.bso']);
    expect(renderCount).toBe(1);

    await act(() => hookResult.handleUnsubscribe('b.bso'));
    await act(() => root.render(createElement(HookHarness, { currentList: ['a.bso'], resetKey: 'account-1' })));

    expect(hookResult.list).toEqual(['a.bso', 'b.bso']);
    expect(hookResult.isUnsubscribed('b.bso')).toBe(true);
    expect(hookResult.isUnsubscribed('a.bso')).toBe(false);
  });

  it('takes a fresh snapshot and clears unsubscribed addresses when the reset dependencies change', async () => {
    await act(() => root.render(createElement(HookHarness, { currentList: ['a.bso', 'b.bso'], resetKey: 'account-1' })));
    await act(() => hookResult.handleUnsubscribe('b.bso'));

    await act(() => root.render(createElement(HookHarness, { currentList: ['c.bso'], resetKey: 'account-2' })));

    expect(hookResult.list).toEqual(['c.bso']);
    expect(hookResult.isUnsubscribed('b.bso')).toBe(false);
  });
});
