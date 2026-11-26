import { useTranslation } from 'react-i18next';
import useLocalNotificationsSetting from '../../../hooks/use-local-notifications-setting';
import styles from './notifications-settings.module.css';

const NotificationsSettings = () => {
  const { t } = useTranslation();
  const { enabled, setNotificationsEnabled, isDisabled, isNotSupported, isRequesting, showDenied, showSuccess, deniedMessage, showTestNotification } =
    useLocalNotificationsSetting();

  return (
    <div className={styles.notificationsSettings}>
      <div>
        <input
          type='checkbox'
          id='enableLocalNotifications'
          checked={enabled}
          onChange={(event) => void setNotificationsEnabled(event.target.checked)}
          disabled={isDisabled}
        />
        <label htmlFor='enableLocalNotifications'>{t('new_replies_received')}</label>

        {/* Not supported message */}
        {isNotSupported && (
          <span className={styles.permissionStatus} data-status='not-supported'>
            <span className={styles.permissionStatusDenied}>Notifications are not supported on this system.</span>
          </span>
        )}

        {/* Permission status messages */}
        {showDenied && (
          <span className={styles.permissionStatus} data-status='denied'>
            <span className={styles.permissionStatusDenied}>{deniedMessage}</span>
          </span>
        )}
        {isRequesting && (
          <span className={styles.permissionStatus} data-status='requesting...'>
            <span className={styles.permissionStatusRequesting}>Click "Allow" to enable notifications</span>
          </span>
        )}
        {showSuccess && (
          <span className={styles.permissionStatus} data-status='granted'>
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
