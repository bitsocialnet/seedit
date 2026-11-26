// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCommunitySettingsStore from '../../stores/use-community-settings-store';
import ModernCommunitySettings from './modern-community-settings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  account: { author: { address: 'owner.bso' } },
  community: {} as Record<string, any>,
  pathname: '/s/example.bso/settings',
  rpcState: 'connected',
  createdCommunity: undefined as { address: string } | undefined,
  lastEditOptions: undefined as Record<string, any> | undefined,
  lastCreateOptions: undefined as Record<string, any> | undefined,
  publishCommunityEdit: vi.fn().mockResolvedValue(undefined),
  createCommunity: vi.fn().mockResolvedValue(undefined),
  navigate: vi.fn(),
  subscribe: vi.fn(),
  // stable, as the real hook's state is between updates
  connectedRpc: {
    state: 'connected',
    pkcRpcSettings: {
      challenges: {
        'captcha-canvas-v3': { type: 'image', description: 'Image challenge', optionInputs: [{ option: 'difficulty', label: 'Difficulty', default: '2' }] },
        question: { type: 'text/plain', description: 'Question challenge', optionInputs: [] },
      },
    },
  },
  disconnectedRpc: { state: 'disconnected', pkcRpcSettings: undefined },
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  deleteCommunity: vi.fn(),
  useAccount: () => testState.account,
  useCommunity: () => testState.community,
  usePkcRpcSettings: () => (testState.rpcState === 'connected' ? testState.connectedRpc : testState.disconnectedRpc),
  usePublishCommunityEdit: (options: Record<string, any>) => {
    testState.lastEditOptions = options;
    return { publishCommunityEdit: testState.publishCommunityEdit };
  },
  useCreateCommunity: (options: Record<string, any>) => {
    testState.lastCreateOptions = options;
    return { createCommunity: testState.createCommunity, createdCommunity: testState.createdCommunity };
  },
  useSubscribe: () => ({ subscribe: testState.subscribe }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => createElement('a', { href: to, className }, children),
  useLocation: () => ({ pathname: testState.pathname, hash: '' }),
  useNavigate: () => testState.navigate,
  useParams: () => (testState.pathname.startsWith('/s/') ? { communityAddress: 'example.bso' } : {}),
}));
vi.mock('../../hooks/use-resolved-community-route', () => ({
  default: () => ({ communityAddress: testState.pathname.startsWith('/s/') ? 'example.bso' : undefined }),
}));
vi.mock('../../hooks/use-is-community-offline', () => ({ default: () => ({ isOffline: false, offlineTitle: '' }) }));
vi.mock('../../hooks/use-state-string', () => ({ default: () => '' }));
vi.mock('../../components/community-reachability-alert', () => ({ default: () => null }));
vi.mock('../../components/markdown', () => ({ default: ({ content }: { content: string }) => createElement('div', null, content) }));
vi.mock('../../components/modern-layout', () => ({
  ModernColumns: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  modernStyles: {},
}));

let container: HTMLDivElement;
let root: Root;

const render = () => act(async () => root.render(createElement(ModernCommunitySettings)));

const getByLabel = (label: string) => {
  const element = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!element) throw new Error(`No element labelled ${label}`);
  return element;
};

const getButton = (text: string) => {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`Button ${text} not found`);
  return button;
};

// React tracks a controlled field's value, so a typed value goes through the native setter.
const type = async (element: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('ModernCommunitySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.pathname = '/s/example.bso/settings';
    testState.rpcState = 'connected';
    testState.createdCommunity = undefined;
    testState.community = {
      address: 'example.bso',
      createdAt: 1,
      title: 'Original title',
      description: 'Original description',
      rules: ['Be kind'],
      roles: { 'owner.bso': { role: 'owner' } },
      settings: {
        challenges: [
          { name: 'captcha-canvas-v3', options: { difficulty: '3' } },
          { name: 'question', exclude: [{ challenges: [0] }, { roles: ['moderator'] }] },
        ],
      },
    };
    useCommunitySettingsStore.getState().resetCommunitySettingsStore();
    vi.stubGlobal('scrollTo', vi.fn());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('saves an edited title with the rest of the settings, and says so until the next edit', async () => {
    await render();
    const title = container.querySelector<HTMLInputElement>('input[aria-labelledby="title-title"]')!;
    expect(title.value).toBe('Original title');

    await type(title, 'Edited title');
    expect(testState.lastEditOptions).toMatchObject({
      communityAddress: 'example.bso',
      title: 'Edited title',
      rules: ['Be kind'],
      settings: testState.community.settings,
    });

    await act(async () => container.querySelector('form')!.requestSubmit());
    expect(testState.publishCommunityEdit).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="status"]')?.textContent).toBe('settings_saved');

    await type(title, 'Edited again');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
  });

  it('renumbers the challenges exclude groups name when one is removed', async () => {
    await render();
    await act(async () => getByLabel('Remove challenge 1').click());
    expect(testState.lastEditOptions?.settings.challenges).toEqual([{ name: 'question', exclude: [{}, { roles: ['moderator'] }] }]);
  });

  it('writes exclude groups in the fields pkc-js reads', async () => {
    await render();
    const groupRoles = container.querySelector('[aria-labelledby="community-challenge-0-group-0-roles"]');
    expect(groupRoles).toBeNull();

    await act(async () => getButton('Add a group').click());
    const adminChip = Array.from(container.querySelectorAll('[aria-labelledby="community-challenge-0-group-0-roles"] label')).find(
      (label) => label.textContent === 'admin',
    );
    await act(async () => adminChip!.querySelector('input')!.click());
    await type(container.querySelector<HTMLInputElement>('#community-challenge-0-group-0-addresses')!, 'alice.bso, 12D3KooWKey');

    expect(testState.lastEditOptions?.settings.challenges[0].exclude).toEqual([{ roles: ['admin'], names: ['alice.bso'], publicKeys: ['12D3KooWKey'] }]);
  });

  it('shows visitors what the community publishes, without editing controls', async () => {
    testState.account = { author: { address: 'visitor.bso' } };
    testState.community = {
      ...testState.community,
      settings: undefined,
      challenges: [{ type: 'text/plain', description: 'Question challenge', exclude: [{ challenges: [1] }, { roles: ['owner', 'admin'] }] }],
    };
    await render();

    expect(container.textContent).toContain('owner_settings_notice');
    expect(container.querySelector('button[type="submit"]')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
    expect(container.textContent).toContain('author passed challenge 2');
    expect(container.textContent).toContain("author's role is owner or admin");
    testState.account = { author: { address: 'owner.bso' } };
  });

  it('points to the desktop app when there is no full node to create a community on', async () => {
    testState.pathname = '/communities/create';
    testState.rpcState = 'disconnected';
    testState.community = {};
    await render();

    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('a[href*="github.com/bitsocialnet/seedit/releases"]')).not.toBeNull();
  });

  it('creates a community owned by the account with the default challenge, then opens it', async () => {
    testState.pathname = '/communities/create';
    testState.community = {};
    await render();

    expect(testState.lastCreateOptions).toMatchObject({
      roles: { 'owner.bso': { role: 'owner' } },
      settings: { challenges: [{ name: 'captcha-canvas-v3', options: { difficulty: '2' } }] },
    });
    await type(container.querySelector<HTMLInputElement>('input[aria-labelledby="title-title"]')!, 'New community');
    await act(async () => container.querySelector('form')!.requestSubmit());
    expect(testState.createCommunity).toHaveBeenCalledOnce();
    expect(testState.lastCreateOptions?.title).toBe('New community');

    testState.createdCommunity = { address: 'new.bso' };
    await render();
    expect(testState.subscribe).toHaveBeenCalledOnce();
    expect(testState.navigate).toHaveBeenCalledWith('/s/new.bso');
    expect(useCommunitySettingsStore.getState().title).toBeUndefined();
  });
});
