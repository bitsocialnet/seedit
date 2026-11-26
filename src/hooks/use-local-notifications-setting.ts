import { useCallback, useEffect, useRef, useState } from 'react';
import { getNotificationPermissionStatus, requestNotificationPermission, showLocalNotification } from '../lib/push';
import useContentOptionsStore from '../stores/use-content-options-store';

const clearTimeoutRef = (timeoutRef: { current: ReturnType<typeof setTimeout> | null }) => {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
};

/**
 * Notifications for new replies: the setting, the OS or browser permission behind it, and a test notification.
 * Both interfaces' settings pages use it.
 */
const useLocalNotificationsSetting = () => {
  const enabled = useContentOptionsStore((state) => state.enableLocalNotifications);
  const setEnabled = useContentOptionsStore((state) => state.setEnableLocalNotifications);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [flashStatus, setFlashStatus] = useState<'denied' | 'success' | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped by each web/Android permission check and each checkbox change, so a slower earlier check cannot undo them.
  const permissionCheckIdRef = useRef(0);

  const scheduleFlashReset = useCallback((status: 'denied' | 'success') => {
    setFlashStatus(status);
    clearTimeoutRef(flashTimeoutRef);
    flashTimeoutRef.current = setTimeout(() => {
      setFlashStatus(null);
      flashTimeoutRef.current = null;
    }, 5000);
  }, []);

  const checkPermissionStatus = useCallback(async () => {
    if (!window.electronApi) {
      const checkId = ++permissionCheckIdRef.current;
      try {
        const status = await getNotificationPermissionStatus();
        if (checkId !== permissionCheckIdRef.current) return;
        setPermissionStatus(status);
        // Web and Android cannot show notifications without permission, which can be revoked outside the app.
        if (status !== 'granted' && enabled) {
          setEnabled(false);
          if (status === 'denied') scheduleFlashReset('denied');
        }
      } catch (err) {
        if (checkId !== permissionCheckIdRef.current) return;
        console.error('[NotificationsSettings] Error checking notification permission:', err);
        setPermissionStatus('unknown');
      }
      return;
    }
    if (!window.electronApi.getNotificationStatus) return;

    console.log('[Electron Native] Checking OS notification permission status...');
    try {
      const nativeStatus = await window.electronApi.getNotificationStatus();
      console.log('[Electron Native] OS permission status from native API:', nativeStatus);

      setPermissionStatus(nativeStatus);

      if (nativeStatus === 'denied') {
        if (enabled) setEnabled(false);
        scheduleFlashReset('denied');
      } else if (nativeStatus === 'not-determined') {
        console.warn('[NotificationsSettings] Permission status is not-determined, cannot test.');
      } else if (nativeStatus === 'not-supported') {
        if (enabled) setEnabled(false);
      }
    } catch (err) {
      console.error('[Electron Native] Error checking notification permissions:', err);
      setPermissionStatus('unknown');
    }
  }, [enabled, scheduleFlashReset, setEnabled]);

  useEffect(() => {
    if (!window.electronApi) {
      // oxlint-disable-next-line react/set-state-in-effect -- checkPermissionStatus sets state only after awaiting the platform permission API
      void checkPermissionStatus();
      return;
    }

    let cancelled = false;

    const loadPlatform = async () => {
      if (!window.electronApi?.getPlatform) return;
      try {
        const value = await window.electronApi.getPlatform();
        if (!cancelled) setPlatform(value);
      } catch (error) {
        console.error(error);
      }
    };

    loadPlatform();
    // oxlint-disable-next-line react/set-state-in-effect -- checkPermissionStatus sets state only after awaiting the Electron permission API
    void checkPermissionStatus();

    return () => {
      cancelled = true;
    };
  }, [checkPermissionStatus]);

  useEffect(() => () => clearTimeoutRef(flashTimeoutRef), []);

  const setNotificationsEnabled = async (isEnabled: boolean) => {
    permissionCheckIdRef.current += 1;
    setIsLoading(true);
    setFlashStatus(null);

    try {
      if (!isEnabled) {
        setEnabled(false);
      } else if (window.electronApi?.getNotificationStatus) {
        // In Electron, the OS permission decides.
        const currentStatus = await window.electronApi.getNotificationStatus();
        setPermissionStatus(currentStatus);
        if (currentStatus === 'granted') {
          setEnabled(true);
          scheduleFlashReset('success');
        } else if (currentStatus === 'denied') {
          setEnabled(false);
          scheduleFlashReset('denied');
        } else if (currentStatus === 'not-determined') {
          setEnabled(false);
          console.warn('[NotificationsSettings] Permission not determined. User must grant via OS prompt.');
          alert('Notification permission needed. The app will ask when it first tries to notify you, or check System Settings.');
        } else if (currentStatus === 'not-supported') {
          setEnabled(false);
        }
      } else {
        // The web browser's permission API.
        setPermissionStatus('requesting...');
        const granted = await requestNotificationPermission();
        setEnabled(granted);
        setPermissionStatus(granted ? 'granted' : 'denied');
        scheduleFlashReset(granted ? 'success' : 'denied');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const showTestNotification = () => {
    // In Electron, check the OS permission before trying.
    if (window.electronApi?.getNotificationStatus) {
      window.electronApi
        .getNotificationStatus()
        .then((status) => {
          if (status === 'granted') {
            showLocalNotification({ title: 'Electron Test Notification!', body: 'If you see this, permissions are working!' });
          } else if (status === 'denied') {
            alert('Notifications are denied in System Settings.');
            scheduleFlashReset('denied');
          } else if (status === 'not-determined') {
            alert('Permission not yet granted. The app will ask when it first tries to notify you (or test again).');
          } else {
            alert('Notifications may not be supported on this system.');
          }
        })
        .catch((err) => {
          console.error('Error checking status before test:', err);
          alert('Could not check notification status before testing.');
        });
    } else {
      showLocalNotification({ title: 'Look at this fancy notification!', body: 'We did it Seedit!' });
    }
  };

  const deniedMessage =
    window.electronApi?.isElectron && platform === 'darwin'
      ? 'Permission denied. Please go to System Settings > Notifications > Seedit and enable notifications.'
      : window.electronApi?.isElectron
        ? `Permission denied. Please check your system's ${platform ? `(${platform}) ` : ''} notification settings for this application.`
        : `Permission denied. Please allow notifications for this site in your browser settings.`;

  return {
    enabled,
    setNotificationsEnabled,
    isDisabled: isLoading || permissionStatus === 'requesting...' || permissionStatus === 'not-supported',
    isNotSupported: permissionStatus === 'not-supported',
    isRequesting: permissionStatus === 'requesting...',
    /** A denial or success just happened, shown for a few seconds. */
    showDenied: flashStatus === 'denied' && permissionStatus === 'denied',
    showSuccess: flashStatus === 'success' && permissionStatus === 'granted' && enabled,
    deniedMessage,
    showTestNotification,
  };
};

export default useLocalNotificationsSetting;
