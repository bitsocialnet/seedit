// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PURE_P2P_BROWSER_SETTING_KEY } from '../../../lib/p2p-browser-config';
import AdvancedSettings from './advanced-settings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const testState = vi.hoisted(() => ({
  account: undefined as Record<string, any> | undefined,
  setAccount: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  setAccount: (account: unknown) => testState.setAccount(account),
  useAccount: () => testState.account,
  usePkcRpcSettings: () => ({ state: 'disconnected' }),
}));

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } satisfies Storage;
};

const RPC_URL = 'ws://127.0.0.1:9138/secret';
const originalLocation = window.location;

describe('AdvancedSettings full node RPC in the browser', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = async () => {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <AdvancedSettings />
        </MemoryRouter>,
      ),
    );
  };

  const getRpcInput = () => container.querySelector<HTMLInputElement>('input[aria-label="Full node WebSocket RPC URL"]')!;
  const getPureP2PCheckbox = () => container.querySelector<HTMLInputElement>('input[aria-label="Pure P2P browser mode"]')!;
  const save = async () => {
    const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === 'save_options');
    await act(async () => button?.click());
  };
  const savedPkcOptions = () => {
    expect(testState.setAccount).toHaveBeenCalledOnce();
    return (testState.setAccount.mock.calls[0][0] as { pkcOptions: Record<string, unknown> }).pkcOptions;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    testState.setAccount.mockResolvedValue(undefined);
    vi.stubGlobal('localStorage', createStorage());
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload: vi.fn() } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    testState.account = undefined;
  });

  it('keeps a full node RPC URL typed while pure p2p is checked', async () => {
    testState.account = { id: 'account-1', pkcOptions: { libp2pJsClientsOptions: [{ key: 'libp2pjs' }], httpRoutersOptions: ['https://routing.lol'] } };
    await render();
    expect(getPureP2PCheckbox().checked).toBe(true);

    getRpcInput().value = RPC_URL;
    await save();

    expect(savedPkcOptions().pkcRpcClientsOptions).toEqual([RPC_URL]);
    expect(savedPkcOptions().libp2pJsClientsOptions).toBeUndefined();
    expect(localStorage.getItem(PURE_P2P_BROWSER_SETTING_KEY)).toBe('false');
  });

  it('shows a full node RPC account as not pure p2p and keeps its RPC URL on save', async () => {
    testState.account = { id: 'account-1', pkcOptions: { pkcRpcClientsOptions: [RPC_URL], ipfsGatewayUrls: ['https://gateway.example'] } };
    await render();
    expect(getPureP2PCheckbox().checked).toBe(false);
    expect(getRpcInput().value).toBe(RPC_URL);

    await save();

    expect(savedPkcOptions().pkcRpcClientsOptions).toEqual([RPC_URL]);
    expect(savedPkcOptions().libp2pJsClientsOptions).toBeUndefined();
  });

  it('switches a full node RPC account to pure p2p when the box is ticked and the saved RPC URL is left as it was', async () => {
    testState.account = { id: 'account-1', pkcOptions: { pkcRpcClientsOptions: [RPC_URL], ipfsGatewayUrls: ['https://gateway.example'] } };
    await render();
    expect(getRpcInput().value).toBe(RPC_URL);

    await act(async () => getPureP2PCheckbox().click());
    await save();

    expect(savedPkcOptions().pkcRpcClientsOptions).toBeUndefined();
    expect(savedPkcOptions().libp2pJsClientsOptions).toEqual([{ key: 'libp2pjs' }]);
    expect(localStorage.getItem(PURE_P2P_BROWSER_SETTING_KEY)).toBe('true');
  });

  it('keeps a newly typed RPC URL even when pure p2p was ticked', async () => {
    testState.account = { id: 'account-1', pkcOptions: { pkcRpcClientsOptions: [RPC_URL], ipfsGatewayUrls: ['https://gateway.example'] } };
    await render();

    await act(async () => getPureP2PCheckbox().click());
    getRpcInput().value = 'ws://127.0.0.1:9139/other-secret';
    await save();

    expect(savedPkcOptions().pkcRpcClientsOptions).toEqual(['ws://127.0.0.1:9139/other-secret']);
    expect(localStorage.getItem(PURE_P2P_BROWSER_SETTING_KEY)).toBe('false');
  });

  it('still switches to pure p2p once the RPC URL is cleared', async () => {
    testState.account = { id: 'account-1', pkcOptions: { pkcRpcClientsOptions: [RPC_URL], ipfsGatewayUrls: ['https://gateway.example'] } };
    await render();

    getRpcInput().value = '';
    await act(async () => getPureP2PCheckbox().click());
    await save();

    expect(savedPkcOptions().pkcRpcClientsOptions).toBeUndefined();
    expect(savedPkcOptions().libp2pJsClientsOptions).toEqual([{ key: 'libp2pjs' }]);
    expect(localStorage.getItem(PURE_P2P_BROWSER_SETTING_KEY)).toBe('true');
  });

  const createThrowingStorage = () => {
    const storage = createStorage();
    storage.setItem = () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };
    return storage;
  };

  it.each([
    ['throws on write', createThrowingStorage],
    ['is unavailable', () => undefined],
  ])('does not save a switch away from pure p2p when browser storage %s', async (_, createTestStorage) => {
    vi.stubGlobal('localStorage', createTestStorage());
    testState.account = { id: 'account-1', pkcOptions: { libp2pJsClientsOptions: [{ key: 'libp2pjs' }], httpRoutersOptions: ['https://routing.lol'] } };
    await render();

    await act(async () => getPureP2PCheckbox().click());
    expect(getPureP2PCheckbox().checked).toBe(false);
    await save();

    expect(testState.setAccount).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Error saving options'));
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});
