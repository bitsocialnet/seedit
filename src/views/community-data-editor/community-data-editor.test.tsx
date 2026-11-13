// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCommunitySettingsStore from '../../stores/use-community-settings-store';
import CommunityDataEditor from './community-data-editor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  lastEditOptions: undefined as Record<string, any> | undefined,
  publishCommunityEdit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useCommunity: () => ({ address: 'example.bso', createdAt: 1, title: 'Title', settings: {} }),
  usePublishCommunityEdit: (options: Record<string, any>) => {
    testState.lastEditOptions = options;
    return { publishCommunityEdit: testState.publishCommunityEdit };
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ components }: { components: Record<string, React.ReactNode> }) => createElement('span', null, components[1], components[2]),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../hooks/use-resolved-community-route', () => ({ default: () => ({ communityAddress: 'example.bso' }) }));
vi.mock('../../hooks/use-state-string', () => ({ default: () => '' }));
vi.mock('../../components/json-editor', () => ({ default: () => null }));
vi.mock('../../components/error-display', () => ({ default: () => null }));
vi.mock('../../components/loading-ellipsis', () => ({ default: () => null }));

let container: HTMLDivElement;
let root: Root;

const clickSave = async () => {
  await act(async () => container.querySelector('button')?.click());
  // the save runs from an effect after the click
  await act(async () => {});
};

describe('CommunityDataEditor save', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
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
