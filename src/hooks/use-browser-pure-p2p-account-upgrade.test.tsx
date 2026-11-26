// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBrowserPureP2PAccountUpgrade } from './use-browser-pure-p2p-account-upgrade';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type AccountFixture = { id: string; name: string };

const testState = vi.hoisted(() => ({
  account: undefined as AccountFixture | undefined,
  accounts: [] as AccountFixture[],
  accountsState: 'succeeded',
  createAccount: vi.fn(),
  setAccount: vi.fn(),
  setActiveAccount: vi.fn(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  createAccount: (...args: unknown[]) => testState.createAccount(...args),
  setAccount: (...args: unknown[]) => testState.setAccount(...args),
  setActiveAccount: (...args: unknown[]) => testState.setActiveAccount(...args),
  useAccount: () => testState.account,
  useAccounts: () => ({ accounts: testState.accounts, state: testState.accountsState }),
}));
vi.mock('../lib/p2p-runtime', () => ({
  getBrowserPureP2PAccountOptions: vi.fn(),
  shouldUpgradeBrowserPureP2PAccount: () => false,
}));

const HookHarness = () => {
  useBrowserPureP2PAccountUpgrade();
  return null;
};

describe('useBrowserPureP2PAccountUpgrade account recovery', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderWith = async (account: AccountFixture | undefined, accounts: AccountFixture[]) => {
    testState.account = account;
    testState.accounts = accounts;
    await act(async () => root.render(createElement(HookHarness)));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    testState.createAccount.mockResolvedValue(undefined);
    testState.setActiveAccount.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    testState.account = undefined;
    testState.accounts = [];
    testState.accountsState = 'succeeded';
  });

  it('recreates an account each time the only account is deleted', async () => {
    await renderWith(undefined, []);
    expect(testState.createAccount).toHaveBeenCalledTimes(1);

    const recovered = { id: 'account-1', name: 'Account 1' };
    await renderWith(recovered, [recovered]);

    // the recovered account is deleted too
    await renderWith(undefined, []);
    expect(testState.createAccount).toHaveBeenCalledTimes(2);
  });

  it('re-activates the first account each time the active account goes missing', async () => {
    const first = { id: 'account-1', name: 'Account 1' };
    await renderWith(undefined, [first]);
    expect(testState.setActiveAccount).toHaveBeenCalledTimes(1);

    await renderWith(first, [first]);

    await renderWith(undefined, [first]);
    expect(testState.setActiveAccount).toHaveBeenCalledTimes(2);
    expect(testState.setActiveAccount).toHaveBeenLastCalledWith('Account 1');
  });

  it('does not start a second recovery while the first one is still in flight', async () => {
    testState.createAccount.mockReturnValue(new Promise(() => undefined));
    testState.accountsState = 'initializing';
    await renderWith(undefined, []);
    // a store state change reruns the effect while createAccount has not settled
    testState.accountsState = 'succeeded';
    await renderWith(undefined, []);
    expect(testState.createAccount).toHaveBeenCalledTimes(1);
  });
});
