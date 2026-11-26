// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModernSettings from './modern-settings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  location: { pathname: '/settings', hash: '' },
  advanced: {} as Record<string, unknown>,
  save: vi.fn(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => ({ id: 'account-id' }),
  usePkcRpcSettings: () => ({ state: 'connected' }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => createElement('a', { href: to }, children),
  useLocation: () => testState.location,
}));
vi.mock('../../hooks/use-advanced-settings', () => ({ default: () => testState.advanced }));
vi.mock('../../components/modern-layout', () => ({
  ModernColumns: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  modernStyles: {},
}));
vi.mock('../../components/modern-user-profile', () => ({
  ModernUserTabs: ({ tabs }: { tabs: { path: string; isActive: boolean }[] }) => createElement('nav', { 'data-active': tabs.find((tab) => tab.isActive)?.path }),
}));
vi.mock('./general-settings', () => ({ default: () => createElement('div', { 'data-page': 'general' }) }));
vi.mock('./content-settings', () => ({ default: () => createElement('div', { 'data-page': 'content' }) }));

let container: HTMLDivElement;
let root: Root;

const render = (pathname: string) => {
  testState.location = { pathname, hash: '' };
  return act(async () => root.render(createElement(ModernSettings)));
};

// React tracks a controlled field's value, so a typed value goes through the native setter.
const type = async (element: HTMLTextAreaElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('ModernSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('scrollTo', vi.fn());
    testState.advanced = {
      isConnectedToRpc: false,
      canConfigurePureP2PBrowser: true,
      browserPureP2PEnabled: true,
      setBrowserPureP2PEnabled: vi.fn(),
      showsGatewaySettings: false,
      savedValues: {
        ipfsGatewayUrls: 'https://gateway',
        mediaIpfsGatewayUrl: '',
        pubsubProviders: 'https://pubsub',
        httpRouters: 'https://router',
        ethRpcUrls: 'https://eth',
        fullNodeRpc: '',
        dataPath: '',
      },
      save: testState.save,
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('opens the page the route names', async () => {
    await render('/settings');
    expect(container.querySelector('nav')?.getAttribute('data-active')).toBe('/settings');
    expect(container.querySelector('[data-page]')?.getAttribute('data-page')).toBe('general');

    await render('/settings/content-options');
    expect(container.querySelector('nav')?.getAttribute('data-active')).toBe('/settings/content-options');
    expect(container.querySelector('[data-page]')?.getAttribute('data-page')).toBe('content');
  });

  it('saves edited advanced options and keeps the saved values of fields pure P2P hides', async () => {
    await render('/settings/advanced');
    expect(container.querySelector('#modern-settings-ipfs-gateways')).toBeNull();

    await type(container.querySelector<HTMLTextAreaElement>('#modern-settings-http-routers')!, 'https://router\nhttps://other-router');
    await act(async () => container.querySelector('form')!.requestSubmit());

    expect(testState.save).toHaveBeenCalledWith({
      ipfsGatewayUrls: undefined,
      mediaIpfsGatewayUrl: undefined,
      pubsubProviders: undefined,
      httpRouters: 'https://router\nhttps://other-router',
      ethRpcUrls: 'https://eth',
      fullNodeRpc: '',
      dataPath: undefined,
    });
  });

  it('shows gateway fields when the browser is not its own P2P node, and saves them', async () => {
    testState.advanced.showsGatewaySettings = true;
    await render('/settings/advanced');
    await act(async () => container.querySelector('form')!.requestSubmit());
    expect(testState.save).toHaveBeenCalledWith(
      expect.objectContaining({ ipfsGatewayUrls: 'https://gateway', pubsubProviders: 'https://pubsub', mediaIpfsGatewayUrl: '' }),
    );
  });
});
