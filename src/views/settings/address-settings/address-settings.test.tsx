// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AddressSettings from './address-settings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  account: { author: { address: 'signer-address', shortAddress: 'signer-addr' }, signer: { address: 'signer-address' } },
  setAccount: vi.fn(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  setAccount: testState.setAccount,
  useAccount: () => testState.account,
  useResolvedAuthorAddress: () => ({ resolvedAddress: 'signer-address', state: 'succeeded', error: undefined, chainProvider: undefined }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

let container: HTMLDivElement;
let root: Root;

const getButton = (label: string) => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === label) as HTMLButtonElement;
const isSavedShown = () => Array.from(container.querySelectorAll('span')).some((span) => span.textContent === 'saved');

const typeCryptoAddress = async (value: string) => {
  const input = container.querySelector('input[type="text"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('AddressSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not show "saved" when the account write fails', async () => {
    testState.setAccount.mockRejectedValue(new Error('account write failed'));
    await act(async () => root.render(createElement(AddressSettings)));
    await typeCryptoAddress('mine.bso');

    await act(async () => getButton('save').click());

    expect(window.alert).toHaveBeenCalledWith('account write failed');
    expect(isSavedShown()).toBe(false);
  });

  it('shows "saved" for two seconds after a successful write', async () => {
    testState.setAccount.mockResolvedValue(undefined);
    await act(async () => root.render(createElement(AddressSettings)));
    await typeCryptoAddress('mine.bso');

    await act(async () => getButton('save').click());

    expect(testState.setAccount).toHaveBeenCalledWith(expect.objectContaining({ author: expect.objectContaining({ address: 'mine.bso' }) }));
    expect(isSavedShown()).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(isSavedShown()).toBe(false);
  });
});
