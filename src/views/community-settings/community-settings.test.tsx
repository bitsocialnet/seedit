// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCommunitySettingsStore from '../../stores/use-community-settings-store';
import CommunitySettings from './community-settings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  account: { author: { address: 'owner.bso' } },
  community: {} as Record<string, any>,
  pathname: '/s/example.bso/settings',
  lastEditOptions: undefined as Record<string, any> | undefined,
  lastCreateOptions: undefined as Record<string, any> | undefined,
  publishCommunityEdit: vi.fn().mockResolvedValue(undefined),
  createCommunity: vi.fn().mockResolvedValue(undefined),
  navigate: vi.fn(),
  subscribe: vi.fn(),
  t: vi.fn((key: string) => key),
  rpcSettings: {
    state: 'connected',
    pkcRpcSettings: {
      challenges: {
        'captcha-canvas-v3': {
          type: 'image',
          description: 'Image challenge',
          optionInputs: [{ option: 'difficulty', label: 'Difficulty', description: 'Challenge difficulty', placeholder: 'difficulty', default: '2' }],
        },
      },
    },
  },
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  deleteCommunity: vi.fn(),
  useAccount: () => testState.account,
  useCommunity: () => testState.community,
  usePkcRpcSettings: () => testState.rpcSettings,
  usePublishCommunityEdit: (options: Record<string, any>) => {
    testState.lastEditOptions = options;
    return { publishCommunityEdit: testState.publishCommunityEdit };
  },
  useCreateCommunity: (options: Record<string, any>) => {
    testState.lastCreateOptions = options;
    return { createCommunity: testState.createCommunity };
  },
  useSubscribe: () => ({ subscribe: testState.subscribe }),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: testState.t }) }));
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: testState.pathname }),
  useNavigate: () => testState.navigate,
  useParams: () => ({ communityAddress: 'example.bso' }),
}));
vi.mock('../../hooks/use-resolved-community-route', () => ({ default: () => ({ communityAddress: 'example.bso' }) }));
vi.mock('../../hooks/use-is-community-offline', () => ({ default: () => ({ isOffline: false, offlineTitle: '' }) }));
vi.mock('../../hooks/use-state-string', () => ({ default: () => '' }));
vi.mock('../../components/error-display', () => ({ default: () => null }));
vi.mock('../../components/loading-ellipsis', () => ({ default: () => null }));
vi.mock('../../components/sidebar', () => ({ default: () => null }));
vi.mock('../../components/markdown', () => ({ default: ({ content }: { content: string }) => createElement('div', { 'data-testid': 'preview' }, content) }));
vi.mock('../../components/reply-form', () => ({ FormattingHelpTable: () => null }));

let container: HTMLDivElement;
let root: Root;

const render = async () => {
  await act(async () => root.render(createElement(CommunitySettings)));
};

const getInput = (value: string) => {
  const input = Array.from(container.querySelectorAll('input')).find((candidate) => candidate.value === value);
  if (!input) throw new Error(`Input with value ${value} not found`);
  return input;
};

const getButton = (text: string) => {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`Button ${text} not found`);
  return button;
};

const changeInput = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('CommunitySettings field rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.pathname = '/s/example.bso/settings';
    testState.lastEditOptions = undefined;
    testState.lastCreateOptions = undefined;
    testState.community = {
      address: 'example.bso',
      createdAt: 1,
      title: 'Original title',
      description: 'Original description',
      rules: ['Original rule'],
      roles: { 'owner.bso': { role: 'owner' } },
      settings: {
        challenges: [{ name: 'captcha-canvas-v3', options: { difficulty: '3' }, exclude: [{ post: true }, { reply: true }] }],
      },
    };
    useCommunitySettingsStore.getState().resetCommunitySettingsStore();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useCommunitySettingsStore.getState().resetCommunitySettingsStore();
    vi.restoreAllMocks();
  });

  it('edits the title without rendering unrelated fields and keeps the complete latest save options', async () => {
    await render();
    const description = container.querySelector('textarea');
    expect(description?.value).toBe('Original description');
    await act(async () => {
      Array.from(container.querySelectorAll('span'))
        .find((span) => span.textContent === 'formatting_help')
        ?.click();
    });
    await act(async () => getButton('preview').click());
    await act(async () => getButton('show_settings').click());
    testState.t.mockClear();

    await changeInput(getInput('Original title'), 'Edited title');

    expect(testState.t).toHaveBeenCalledWith('title');
    for (const field of ['description', 'address', 'rules', 'moderators', 'challenges', 'json_settings']) {
      expect(testState.t).not.toHaveBeenCalledWith(field);
    }
    expect(container.querySelector('[data-testid="preview"]')?.textContent).toBe('Original description');
    expect(getButton('hide_settings')).toBeDefined();
    expect(getInput('Original rule')).toBeDefined();
    expect(getInput('owner.bso')).toBeDefined();
    expect(getInput('3')).toBeDefined();
    expect(testState.lastEditOptions).toMatchObject({
      communityAddress: 'example.bso',
      title: 'Edited title',
      description: 'Original description',
      rules: ['Original rule'],
      roles: { 'owner.bso': { role: 'owner' } },
      settings: testState.community.settings,
    });

    await act(async () => getButton('save_options').click());
    expect(testState.publishCommunityEdit).toHaveBeenCalledOnce();
  });

  it('updates each field from its store subscription and keeps challenge option and exclusion edits live', async () => {
    await render();

    await act(async () => {
      useCommunitySettingsStore.getState().setCommunitySettingsStore({
        title: 'Updated title',
        description: 'Updated description',
        address: 'updated.bso',
        rules: ['Updated rule'],
        roles: { 'moderator.bso': { role: 'moderator' } },
      });
    });

    expect(getInput('Updated title')).toBeDefined();
    expect(container.querySelector('textarea')?.value).toBe('Updated description');
    expect(getInput('updated.bso')).toBeDefined();
    expect(getInput('Updated rule')).toBeDefined();
    expect(getInput('moderator.bso')).toBeDefined();

    await act(async () => getButton('show_settings').click());
    testState.t.mockClear();
    await changeInput(getInput('3'), '5');
    expect(testState.lastEditOptions?.settings.challenges[0].options.difficulty).toBe('5');
    expect(testState.t).toHaveBeenCalledWith('challenges');
    expect(testState.t).not.toHaveBeenCalledWith('title');

    await act(async () => (container.querySelector('[title="delete group"]') as HTMLElement).click());
    expect(container.querySelectorAll('[title="delete group"]')).toHaveLength(1);
    expect(testState.lastEditOptions?.settings.challenges[0].exclude).toEqual([{ reply: true }]);

    await act(async () => getButton('Add Group').click());
    expect(container.querySelectorAll('[title="delete group"]')).toHaveLength(2);
    expect(testState.lastEditOptions?.settings.challenges[0].exclude).toHaveLength(2);
  });

  it('initializes the create form default challenge and passes the edited draft to the create hook', async () => {
    testState.pathname = '/communities/create';
    testState.community = {};
    await render();

    expect(testState.lastCreateOptions?.settings.challenges).toEqual([{ name: 'captcha-canvas-v3', options: { difficulty: '2' } }]);
    await changeInput(getInput(''), 'New community');
    expect(testState.lastCreateOptions?.title).toBe('New community');
    expect(testState.lastCreateOptions?.settings.challenges[0].options.difficulty).toBe('2');

    await act(async () => getButton('create_community').click());
    expect(testState.createCommunity).toHaveBeenCalledOnce();
  });
});
