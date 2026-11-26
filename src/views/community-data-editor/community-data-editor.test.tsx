// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCommunitySettingsStore from '../../stores/use-community-settings-store';
import CommunityDataEditor from './community-data-editor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const loadedCommunity = { address: 'example.bso', createdAt: 1, title: 'Title', settings: {} } as Record<string, any>;

const testState = vi.hoisted(() => ({
  community: undefined as Record<string, any> | undefined,
  stateString: '',
  lastEditOptions: undefined as Record<string, any> | undefined,
  publishCommunityEdit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  deleteCommunity: vi.fn(),
  useAccount: () => ({ author: { address: 'owner.bso' } }),
  useCommunity: () => testState.community,
  useCreateCommunity: () => ({ createCommunity: vi.fn() }),
  usePkcRpcSettings: () => ({ state: 'connected', pkcRpcSettings: { challenges: {} } }),
  usePublishCommunityEdit: (options: Record<string, any>) => {
    testState.lastEditOptions = options;
    return { publishCommunityEdit: testState.publishCommunityEdit };
  },
  useSubscribe: () => ({ subscribe: vi.fn() }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ components }: { components: Record<string, React.ReactNode> }) => createElement('span', null, components[1], components[2]),
}));
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/s/example.bso/settings/editor' }),
  useNavigate: () => vi.fn(),
  useParams: () => ({ communityAddress: 'example.bso' }),
}));
vi.mock('../../hooks/use-resolved-community-route', () => ({ default: () => ({ communityAddress: 'example.bso' }) }));
vi.mock('../../hooks/use-state-string', () => ({ default: () => testState.stateString }));
vi.mock('../../components/json-editor', () => ({ default: () => null }));
vi.mock('../../components/error-display', () => ({ default: ({ error }: { error?: Error }) => (error ? createElement('span', null, `error: ${error.message}`) : null) }));
// a loading status is an attribute rather than text, so the text of the view stays unchanged
vi.mock('../../components/loading-ellipsis', () => ({ default: ({ string }: { string: string }) => createElement('span', { 'data-loading-status': string }) }));

let container: HTMLDivElement;
let root: Root;

const clickSave = async () => {
  await act(async () => container.querySelector('button')?.click());
  // the save runs from an effect after the click
  await act(async () => {});
};

describe('CommunityDataEditor before the community loads', () => {
  const loadingStatus = () => container.querySelector('[data-loading-status]')?.getAttribute('data-loading-status') ?? undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    testState.community = loadedCommunity;
    testState.stateString = '';
  });

  it('shows a community whose first load failed as failed, and why a retrying one has not loaded', async () => {
    testState.community = { state: 'failed', firstLoadFailed: true, error: new Error('No name resolver can handle this address') };
    await act(async () => root.render(createElement(CommunityDataEditor)));
    expect(container.textContent).toBe('error: No name resolver can handle this addressfailed');
    expect(loadingStatus()).toBeUndefined();

    testState.community = { state: 'fetching-ipns', firstLoadFailed: true, lastRetriableError: new Error('Domain resolver did not find the text record') };
    testState.stateString = 'Waiting retry';
    await act(async () => root.render(createElement(CommunityDataEditor)));
    expect(container.textContent).toBe('error: Domain resolver did not find the text record');
    expect(loadingStatus()).toBe('Waiting retry');
  });
});

describe('CommunityDataEditor save', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    testState.community = loadedCommunity;
    useCommunitySettingsStore.getState().resetCommunitySettingsStore();
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(createElement(CommunityDataEditor)));
    // the editor text is filled after a short debounce
    await act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useCommunitySettingsStore.getState().resetCommunitySettingsStore();
    vi.restoreAllMocks();
  });

  it('alerts the outcome of each save rather than the error from before it', async () => {
    // like the hooks, publishCommunityEdit reports a failure through onError and resolves
    testState.publishCommunityEdit.mockImplementationOnce(async () => testState.lastEditOptions?.onError?.(new Error('edit failed')));

    await clickSave();
    expect(window.alert).toHaveBeenCalledExactlyOnceWith('edit failed');

    vi.mocked(window.alert).mockClear();
    await clickSave();
    expect(window.alert).toHaveBeenCalledExactlyOnceWith('settings_saved');
  });
});
