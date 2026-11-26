import { describe, expect, it } from 'vitest';
import { PURE_P2P_BROWSER_SETTING_KEY } from './p2p-browser-config';
import { isBrowserPureP2PEnabled, shouldUpgradeBrowserPureP2PAccount } from './p2p-runtime';

const createBrowserWindow = (storedPreference?: string) => {
  const values = new Map<string, string>(storedPreference === undefined ? [] : [[PURE_P2P_BROWSER_SETTING_KEY, storedPreference]]);
  return {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  } as unknown as Window;
};

const rpcAccount = { id: 'account-1', pkcOptions: { pkcRpcClientsOptions: ['ws://127.0.0.1:9138/secret'], ipfsGatewayUrls: ['https://gateway.example'] } };
const pureP2PAccount = { id: 'account-1', pkcOptions: { libp2pJsClientsOptions: [{ key: 'libp2pjs' }] } };

describe('isBrowserPureP2PEnabled', () => {
  it('reports a full node RPC account as not using pure p2p whatever the stored preference', () => {
    expect(isBrowserPureP2PEnabled(rpcAccount, createBrowserWindow())).toBe(false);
    expect(isBrowserPureP2PEnabled(rpcAccount, createBrowserWindow('true'))).toBe(false);
  });

  it('reports a browser libp2p account as using pure p2p', () => {
    expect(isBrowserPureP2PEnabled(pureP2PAccount, createBrowserWindow('false'))).toBe(true);
  });

  it('falls back to the stored preference for accounts without a transport', () => {
    expect(isBrowserPureP2PEnabled({ id: 'account-1', pkcOptions: {} }, createBrowserWindow())).toBe(true);
    expect(isBrowserPureP2PEnabled({ id: 'account-1', pkcOptions: {} }, createBrowserWindow('false'))).toBe(false);
  });
});

describe('shouldUpgradeBrowserPureP2PAccount', () => {
  it('never upgrades a full node RPC account to pure p2p', () => {
    expect(shouldUpgradeBrowserPureP2PAccount(rpcAccount, createBrowserWindow())).toBe(false);
    expect(shouldUpgradeBrowserPureP2PAccount(rpcAccount, createBrowserWindow('true'))).toBe(false);
  });
});
