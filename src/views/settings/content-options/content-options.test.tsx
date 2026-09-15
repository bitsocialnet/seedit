// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useContentOptionsStore from '../../../stores/use-content-options-store';
import ContentOptions from './content-options';
import NotificationsSettings from '../notifications-settings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.hoisted(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } satisfies Storage);
});

afterAll(() => vi.unstubAllGlobals());

const mocks = vi.hoisted(() => ({
  translate: vi.fn((key: string) => key),
  requestNotificationPermission: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mocks.translate }) }));
vi.mock('@bitsocial/bitsocial-react-hooks', () => ({ useAccount: () => undefined, setAccount: vi.fn() }));
vi.mock('../../../hooks/use-default-subscriptions', () => ({ useDefaultSubscriptions: () => [] }));
vi.mock('../../../hooks/use-is-mobile', () => ({ default: () => false }));
vi.mock('../../../lib/push', () => ({ requestNotificationPermission: mocks.requestNotificationPermission, showLocalNotification: vi.fn() }));

const initialState = useContentOptionsStore.getState();
const initialStorage = localStorage.getItem('content-options');
const initialElectronApi = window.electronApi;

describe('Settings content-option subscriptions', () => {
  let container: HTMLDivElement;
  let root: Root;

  const getCheckbox = (label: string) => {
    const labelElement = Array.from(container.querySelectorAll('label')).find((candidate) => candidate.textContent === label);
    const input = labelElement?.querySelector('input') ?? (labelElement?.htmlFor ? document.getElementById(labelElement.htmlFor) : null);
    if (!(input instanceof HTMLInputElement)) throw new Error(`Missing checkbox: ${label}`);
    return input;
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    window.electronApi = undefined;
    mocks.requestNotificationPermission.mockResolvedValue(true);
    useContentOptionsStore.setState({ ...initialState, infiniteFeedEnabled: false, autoHideTopbar: false });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <>
          <ContentOptions />
          <NotificationsSettings />
        </>,
      );
    });
    mocks.translate.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    useContentOptionsStore.setState(initialState, true);
    if (initialStorage === null) localStorage.removeItem('content-options');
    else localStorage.setItem('content-options', initialStorage);
    window.electronApi = initialElectronApi;
    vi.useRealTimers();
  });

  it('updates feed, media, and community controls without rendering unrelated settings sections', async () => {
    expect(getCheckbox('auto_hide_topbar_while_scrolling').disabled).toBe(true);
    await act(async () => getCheckbox('enable_infinite_feed').click());
    expect(useContentOptionsStore.getState().infiniteFeedEnabled).toBe(true);
    expect(getCheckbox('auto_hide_topbar_while_scrolling').disabled).toBe(false);
    expect(mocks.translate).toHaveBeenCalledWith('enable_infinite_feed');
    expect(mocks.translate).not.toHaveBeenCalledWith('media_previews');
    expect(mocks.translate).not.toHaveBeenCalledWith('default_communities');
    expect(mocks.translate).not.toHaveBeenCalledWith('new_replies_received');

    mocks.translate.mockClear();
    const hideThumbnails = container.querySelector<HTMLInputElement>('input[name="thumbnailOption"][value="hide"]');
    await act(async () => hideThumbnails?.click());
    expect(useContentOptionsStore.getState().thumbnailDisplayOption).toBe('hide');
    expect(hideThumbnails?.checked).toBe(true);
    expect(mocks.translate).toHaveBeenCalledWith('media_previews');
    expect(mocks.translate).not.toHaveBeenCalledWith('default_communities');
    expect(mocks.translate).not.toHaveBeenCalledWith('enable_infinite_feed');
    expect(mocks.translate).not.toHaveBeenCalledWith('new_replies_received');

    mocks.translate.mockClear();
    await act(async () => getCheckbox('hide_default_communities_from_topbar').click());
    expect(useContentOptionsStore.getState().hideDefaultCommunities).toBe(true);
    expect(getCheckbox('hide_default_communities_from_topbar').checked).toBe(true);
    expect(mocks.translate).toHaveBeenCalledWith('default_communities');
    expect(mocks.translate).not.toHaveBeenCalledWith('media_previews');
    expect(mocks.translate).not.toHaveBeenCalledWith('enable_infinite_feed');
    expect(mocks.translate).not.toHaveBeenCalledWith('new_replies_received');
  });

  it('keeps notification permission and enablement reactive without rendering content settings', async () => {
    await act(async () => getCheckbox('new_replies_received').click());
    expect(mocks.requestNotificationPermission).toHaveBeenCalledOnce();
    expect(useContentOptionsStore.getState().enableLocalNotifications).toBe(true);
    expect(getCheckbox('new_replies_received').checked).toBe(true);
    expect(container.querySelector('[data-status="granted"]')).not.toBeNull();
    expect(mocks.translate).toHaveBeenCalledWith('new_replies_received');
    expect(mocks.translate).not.toHaveBeenCalledWith('media_previews');
    expect(mocks.translate).not.toHaveBeenCalledWith('default_communities');
    expect(mocks.translate).not.toHaveBeenCalledWith('enable_infinite_feed');

    await act(async () => getCheckbox('new_replies_received').click());
    expect(useContentOptionsStore.getState().enableLocalNotifications).toBe(false);
    expect(getCheckbox('new_replies_received').checked).toBe(false);
    expect(mocks.requestNotificationPermission).toHaveBeenCalledOnce();
  });
});
