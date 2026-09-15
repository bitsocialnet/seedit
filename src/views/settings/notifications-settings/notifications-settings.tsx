import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { requestNotificationPermission, showLocalNotification } from '../../../lib/push';
import useContentOptionsStore from '../../../stores/use-content-options-store';
import styles from './notifications-settings.module.css';

const clearTimeoutRef = (timeoutRef: { current: ReturnType<typeof setTimeout> | null }) => {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
};

const NotificationsSettings = () => {
  const { t } = useTranslation();
  const enableLocalNotifications = useContentOptionsStore((state) => state.enableLocalNotifications);
  const setEnableLocalNotifications = useContentOptionsStore((state) => state.setEnableLocalNotifications);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [flashStatus, setFlashStatus] = useState<'denied' | 'success' | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleFlashReset = useCallback((status: 'denied' | 'success') => {
    setFlashStatus(status);
    clearTimeoutRef(flashTimeoutRef);
    flashTimeoutRef.current = setTimeout(() => {
      setFlashStatus(null);
      flashTimeoutRef.current = null;
    }, 5000);
  }, []);

  // Function to check permission via API, memoized with useCallback
  const checkPermissionStatus = useCallback(async () => {
    if (!window.electronApi?.getNotificationStatus) return;

    console.log('[Electron Native] Checking OS notification permission status...');
    try {
      const nativeStatus = await window.electronApi.getNotificationStatus();
      console.log('[Electron Native] OS permission status from native API:', nativeStatus);

      setPermissionStatus(nativeStatus); // Directly set the status received

      if (nativeStatus === 'denied') {
        if (enableLocalNotifications) {
          setEnableLocalNotifications(false);
        }
        scheduleFlashReset('denied');
      } else if (nativeStatus === 'not-determined') {
        console.warn('[NotificationsSettings] Permission status is not-determined, cannot test.');
      } else if (nativeStatus === 'not-supported') {
        if (enableLocalNotifications) {
          setEnableLocalNotifications(false);
        }
      }
    } catch (err) {
      console.error('[Electron Native] Error checking notification permissions:', err);
      setPermissionStatus('unknown');
    }
  }, [enableLocalNotifications, scheduleFlashReset, setEnableLocalNotifications]);

  useEffect(() => {
    if (!window.electronApi) return;

    let cancelled = false;

    const loadPlatform = async () => {
      if (!window.electronApi?.getPlatform) return;
      try {
        const value = await window.electronApi.getPlatform();
        if (!cancelled) {
          setPlatform(value);
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadPlatform();
    void checkPermissionStatus();

    return () => {
      cancelled = true;
    };
  }, [checkPermissionStatus]);

  useEffect(() => () => clearTimeoutRef(flashTimeoutRef), []);

  const handleCheckboxChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabled = event.target.checked;
    setIsLoading(true);
    setFlashStatus(null);

    try {
      if (isEnabled) {
        // If in Electron, check status first
        if (window.electronApi?.getNotificationStatus) {
          const currentStatus = await window.electronApi.getNotificationStatus();
          setPermissionStatus(currentStatus);
          if (currentStatus === 'granted') {
            setEnableLocalNotifications(true);
            scheduleFlashReset('success');
          } else if (currentStatus === 'denied') {
            setEnableLocalNotifications(false); // Ensure it's off if denied
            scheduleFlashReset('denied');
          } else if (currentStatus === 'not-determined') {
            setEnableLocalNotifications(false); // Keep it off until granted
            console.warn('[NotificationsSettings] Permission not determined. User must grant via OS prompt.');
            alert('Notification permission needed. The app will ask when it first tries to notify you, or check System Settings.');
          } else if (currentStatus === 'not-supported') {
            setEnableLocalNotifications(false); // Keep it off
          }
        } else {
          // Use the web browser API for non-Electron
          setPermissionStatus('requesting...');
          const granted = await requestNotificationPermission();
          if (granted) {
            setEnableLocalNotifications(true);
            setPermissionStatus('granted');
            scheduleFlashReset('success');
          } else {
            setEnableLocalNotifications(false);
            setPermissionStatus('denied');
            scheduleFlashReset('denied');
          }
        }
      } else {
        setEnableLocalNotifications(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Function to manually test a notification
  const showTestNotification = () => {
    // If we're on Electron, check status before attempting to show
    if (window.electronApi?.getNotificationStatus) {
      window.electronApi
        .getNotificationStatus()
        .then((status) => {
          if (status === 'granted') {
            // Use the showElectronLocalNotification via the main push index
            import('../../../lib/push').then(({ showLocalNotification }) => {
              showLocalNotification({
                title: 'Electron Test Notification!',
                body: 'If you see this, permissions are working!',
              });
            });
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
      // Directly call the local notification API for web/native environments
      showLocalNotification({
        title: 'Look at this fancy notification!',
        body: 'We did it Seedit!',
      });
    }
  };

  return (
    <div className={styles.notificationsSettings}>
      <div>
        <input
          type='checkbox'
          id='enableLocalNotifications'
          checked={enableLocalNotifications}
          onChange={handleCheckboxChange}
          disabled={isLoading || permissionStatus === 'requesting...' || permissionStatus === 'not-supported'}
        />
        <label htmlFor='enableLocalNotifications'>{t('new_replies_received')}</label>

        {/* Not supported message */}
        {permissionStatus === 'not-supported' && (
          <span className={styles.permissionStatus} data-status='not-supported'>
            <span className={styles.permissionStatusDenied}>Notifications are not supported on this system.</span>
          </span>
        )}

        {/* Permission status messages */}
        {flashStatus === 'denied' && permissionStatus === 'denied' && (
          <span className={styles.permissionStatus} data-status={permissionStatus}>
            <span className={styles.permissionStatusDenied}>
              {window.electronApi?.isElectron && platform === 'darwin'
                ? 'Permission denied. Please go to System Settings > Notifications > Seedit and enable notifications.'
                : window.electronApi?.isElectron
                  ? `Permission denied. Please check your system's ${platform ? `(${platform}) ` : ''} notification settings for this application.`
                  : `Permission denied. Please allow notifications for this site in your browser settings.`}
            </span>
          </span>
        )}
        {permissionStatus === 'requesting...' && (
          <span className={styles.permissionStatus} data-status={permissionStatus}>
            <span className={styles.permissionStatusRequesting}>Click "Allow" to enable notifications</span>
          </span>
        )}
        {flashStatus === 'success' && permissionStatus === 'granted' && enableLocalNotifications && (
          <span className={styles.permissionStatus} data-status={permissionStatus}>
            <span className={styles.permissionStatusSuccess}>
              Success! You're done.
              <span className={styles.permissionStatusTestButton} onClick={showTestNotification}>
                (Test)
              </span>
            </span>
          </span>
        )}
      </div>
    </div>
  );
};

export default NotificationsSettings;
