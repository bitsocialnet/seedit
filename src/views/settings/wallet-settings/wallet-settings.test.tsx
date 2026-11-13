// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WalletSettings from './wallet-settings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const savedEthWallet = { address: '0xwallet', timestamp: 1700000000, signature: { signature: '0xsignature', type: 'eip191' } };
const savedSolWallet = { address: 'solwallet', timestamp: 1700000001, signature: { signature: 'solsignature', type: 'eip191' } };
const createAccount = (wallets: Record<string, typeof savedEthWallet>) => ({ author: { address: 'author-address', wallets } });

const testState = vi.hoisted(() => ({
  account: undefined as unknown as { author: { address: string; wallets: Record<string, unknown> } },
  setAccount: vi.fn(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  setAccount: testState.setAccount,
  useAccount: () => testState.account,
}));
vi.mock('react-i18next', async () => {
  const ReactModule = await import('react');
  return {
    Trans: ({ components, i18nKey }: { components?: Record<number, React.ReactElement>; i18nKey: string }) => {
      const component = components?.[1];
      return component ? ReactModule.cloneElement(component, {}, i18nKey) : i18nKey;
    },
    useTranslation: () => ({ t: (key: string) => key }),
  };
});
vi.mock('../../../components/info-tooltip', () => ({ default: () => null }));

let container: HTMLDivElement;
let root: Root;

const getButtons = (label: string) => Array.from(container.querySelectorAll('button')).filter((button) => button.textContent === label);
const getButton = (label: string) => getButtons(label)[0];
const getInputWithValue = (value: string) => Array.from(container.querySelectorAll('input')).find((input) => input.value === value) as HTMLInputElement;
const getSignatureInput = () => getInputWithValue('0xsignature');

const setInput = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const clearInput = (input: HTMLInputElement) => setInput(input, '');

describe('WalletSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.account = createAccount({ eth: savedEthWallet });
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('does not report "saved" when the account write fails', async () => {
    testState.setAccount.mockRejectedValue(new Error('account write failed'));
    await act(async () => root.render(createElement(WalletSettings)));

    await act(async () => getButton('save').click());

    expect(testState.setAccount).toHaveBeenCalledTimes(1);
    expect(window.alert).toHaveBeenCalledWith('account write failed');
    expect(window.alert).not.toHaveBeenCalledWith('saved');
  });

  it('does not save or report "saved" while a wallet is missing its signature', async () => {
    testState.setAccount.mockResolvedValue(undefined);
    await act(async () => root.render(createElement(WalletSettings)));
    await clearInput(getSignatureInput());

    await act(async () => getButton('save').click());

    expect(testState.setAccount).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('missing signature'));
    expect(window.alert).not.toHaveBeenCalledWith('saved');
  });

  it('reports "saved" after the wallets are written', async () => {
    testState.setAccount.mockResolvedValue(undefined);
    await act(async () => root.render(createElement(WalletSettings)));

    await act(async () => getButton('save').click());

    expect(testState.setAccount).toHaveBeenCalledWith(expect.objectContaining({ author: expect.objectContaining({ wallets: testState.account.author.wallets }) }));
    expect(window.alert).toHaveBeenCalledWith('saved');
  });

  it('removes only the chosen saved wallet and leaves unsaved edits of the others out of the write', async () => {
    testState.account = createAccount({ eth: savedEthWallet, sol: savedSolWallet });
    testState.setAccount.mockResolvedValue(undefined);
    await act(async () => root.render(createElement(WalletSettings)));
    await clearInput(getSignatureInput());

    await act(async () => getButtons('remove')[1].click());

    expect(testState.setAccount).toHaveBeenCalledTimes(1);
    expect(testState.setAccount.mock.calls[0][0].author.wallets).toEqual({ eth: savedEthWallet });
    expect(window.alert).not.toHaveBeenCalled();
    expect(getInputWithValue('solwallet')).toBeUndefined();
  });

  it('keeps the wallet in the form when removing it fails', async () => {
    testState.setAccount.mockRejectedValue(new Error('account write failed'));
    await act(async () => root.render(createElement(WalletSettings)));

    await act(async () => getButton('remove').click());

    expect(window.alert).toHaveBeenCalledWith('account write failed');
    expect(getInputWithValue('0xwallet')).toBeDefined();
  });

  it('does not save while two wallets share a chain ticker, so removing one keeps the other', async () => {
    testState.account = createAccount({ eth: savedEthWallet, sol: savedSolWallet });
    testState.setAccount.mockResolvedValue(undefined);
    await act(async () => root.render(createElement(WalletSettings)));
    await setInput(getInputWithValue('sol'), 'eth');

    await act(async () => getButton('save').click());

    expect(testState.setAccount).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('duplicate chain ticker eth'));
    expect(window.alert).not.toHaveBeenCalledWith('saved');

    await act(async () => getButtons('remove')[0].click());

    expect(testState.setAccount).toHaveBeenCalledTimes(1);
    expect(testState.setAccount.mock.calls[0][0].author.wallets).toEqual({ sol: savedSolWallet });
  });

  it('removes a wallet under the chain ticker it was last saved with', async () => {
    testState.setAccount.mockImplementation(async (account) => {
      testState.account = account;
    });
    await act(async () => root.render(createElement(WalletSettings)));
    await setInput(getInputWithValue('eth'), 'btc');
    await act(async () => getButton('save').click());
    expect(testState.account.author.wallets).toEqual({ btc: savedEthWallet });
    // useAccount re-renders with the saved account in the app; the mock needs an explicit render.
    await act(async () => root.render(createElement(WalletSettings)));

    await act(async () => getButton('remove').click());

    expect(testState.account.author.wallets).toEqual({});
  });

  it('removes only the chosen row when two new wallets were added', async () => {
    testState.account = createAccount({});
    await act(async () => root.render(createElement(WalletSettings)));
    await act(async () => getButton('add_wallet').click());
    await act(async () => getButton('add_wallet').click());
    expect(getButtons('remove')).toHaveLength(2);

    await act(async () => getButtons('remove')[1].click());

    expect(getButtons('remove')).toHaveLength(1);
    expect(testState.setAccount).not.toHaveBeenCalled();
  });

  it('does not start another wallet write before the pending one lands', async () => {
    testState.account = createAccount({ eth: savedEthWallet, sol: savedSolWallet });
    let landWrite!: () => void;
    const writeCanLand = new Promise<void>((resolve) => {
      landWrite = resolve;
    });
    testState.setAccount.mockImplementation(async (account) => {
      await writeCanLand;
      testState.account = account;
    });
    await act(async () => root.render(createElement(WalletSettings)));

    await act(async () => getButtons('remove')[0].click());
    // The account prop still lists the removed wallet, so a write started now would bring it back.
    await act(async () => getButtons('remove')[1].click());
    await act(async () => getButton('save').click());

    expect(testState.setAccount).toHaveBeenCalledTimes(1);
    expect([...getButtons('remove'), ...getButtons('save')].every((button) => button.disabled)).toBe(true);

    await act(async () => landWrite());
    // useAccount re-renders with the saved account in the app; the mock needs an explicit render.
    await act(async () => root.render(createElement(WalletSettings)));
    await act(async () => getButton('remove').click());

    expect(testState.setAccount).toHaveBeenCalledTimes(2);
    expect(testState.account.author.wallets).toEqual({});
  });
});
