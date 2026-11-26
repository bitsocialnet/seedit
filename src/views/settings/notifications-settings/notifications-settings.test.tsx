// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useContentOptionsStore from '../../../stores/use-content-options-store';
import NotificationsSettings from './notifications-settings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const testState = vi.hoisted(() => ({
  isNativePlatform: false,
  nativeDisplayPermission: 'granted',
  // The next checkPermissions call returns this promise instead of resolving right away.
  pendingCheckPermissions: undefined as Promise<{ display: string }> | undefined,
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => testState.isNativePlatform } }));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: async () => {
      const pending = testState.pendingCheckPermissions;
      testState.pendingCheckPermissions = undefined;
      return pending ?? { display: testState.nativeDisplayPermission };
    },
    requestPermissions: async () => ({ display: testState.nativeDisplayPermission }),
    schedule: vi.fn(),
    addListener: vi.fn(),
  },
}));

const initialContentOptions = useContentOptionsStore.getState();
const initialElectronApi = window.electronApi;

const stubWebNotifications = (permission: NotificationPermission | undefined) => {
  if (permission === undefined) {
    Reflect.deleteProperty(window, 'Notification');
  } else {
    vi.stubGlobal('Notification', { permission, requestPermission: vi.fn(async () => permission) });
  }
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: permission === undefined ? undefined : {} });
};

describe('NotificationsSettings permission reconciliation', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = async () => {
    await act(async () => root.render(<NotificationsSettings />));
  };

  const getCheckbox = () => container.querySelector<HTMLInputElement>('#enableLocalNotifications')!;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    window.electronApi = undefined;
    testState.isNativePlatform = false;
    testState.nativeDisplayPermission = 'granted';
    testState.pendingCheckPermissions = undefined;
    useContentOptionsStore.setState({ enableLocalNotifications: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    useContentOptionsStore.setState(initialContentOptions, true);
    window.electronApi = initialElectronApi;
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('turns the setting off when the browser permission was revoked', async () => {
    stubWebNotifications('denied');
    await render();

    expect(useContentOptionsStore.getState().enableLocalNotifications).toBe(false);
    expect(getCheckbox().checked).toBe(false);
    expect(container.querySelector('[data-status="denied"]')).not.toBeNull();
  });

  it('turns the setting off when the browser permission was reset to ask', async () => {
    stubWebNotifications('default');
    await render();

    expect(useContentOptionsStore.getState().enableLocalNotifications).toBe(false);
  });

  it('keeps the setting on while the browser permission is granted', async () => {
    stubWebNotifications('granted');
    await render();

    expect(useContentOptionsStore.getState().enableLocalNotifications).toBe(true);
    expect(getCheckbox().checked).toBe(true);
  });

  it('reports notifications as unsupported instead of denied when the browser has no Notification API', async () => {
    stubWebNotifications(undefined);
    await render();

    expect(useContentOptionsStore.getState().enableLocalNotifications).toBe(false);
    expect(getCheckbox().disabled).toBe(true);
    expect(container.querySelector('[data-status="not-supported"]')).not.toBeNull();
    expect(container.querySelector('[data-status="denied"]')).toBeNull();
  });

  it('turns the setting off when the Android permission was revoked', async () => {
    testState.isNativePlatform = true;
    testState.nativeDisplayPermission = 'denied';
    await render();

    expect(useContentOptionsStore.getState().enableLocalNotifications).toBe(false);
  });

  it('keeps the setting on while the Android permission is granted', async () => {
    testState.isNativePlatform = true;
    testState.nativeDisplayPermission = 'granted';
    await render();

    expect(useContentOptionsStore.getState().enableLocalNotifications).toBe(true);
  });

  it('ignores an Android permission check that resolves after the user granted the permission', async () => {
    testState.isNativePlatform = true;
    testState.nativeDisplayPermission = 'denied';
    let resolveMountCheck: (value: { display: string }) => void = () => undefined;
    testState.pendingCheckPermissions = new Promise((resolve) => {
      resolveMountCheck = resolve;
    });
    await render();
    expect(useContentOptionsStore.getState().enableLocalNotifications).toBe(true);

    testState.nativeDisplayPermission = 'granted';
    await act(async () => getCheckbox().click());
    await act(async () => getCheckbox().click());
    expect(useContentOptionsStore.getState().enableLocalNotifications).toBe(true);

    await act(async () => resolveMountCheck({ display: 'denied' }));

    expect(useContentOptionsStore.getState().enableLocalNotifications).toBe(true);
    expect(getCheckbox().checked).toBe(true);
  });
});
