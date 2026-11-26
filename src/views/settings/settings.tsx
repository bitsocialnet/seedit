import { lazy, Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useAccount, usePkcRpcSettings } from '@bitsocial/bitsocial-react-hooks';
import { isSettingsAdvancedView, isSettingsP2pStatsView, isSettingsContentOptionsView, isSettingsDebugView } from '../../lib/utils/view-utils';
import { getReviewableSettingsUpgrades, getSettingsUpgradeKey, type SettingsUpgradeAccount } from '../../lib/settings-upgrades';
import useCheckForUpdates from '../../hooks/use-check-for-updates';
import useDisplayNameSetting from '../../hooks/use-display-name-setting';
import useTheme from '../../hooks/use-theme';
import useUiModeStore from '../../stores/use-ui-mode-store';
import { isUiMode } from '../../lib/utils/ui-mode-utils';
import useSettingsUpgradeReviewStore from '../../stores/use-settings-upgrade-review-store';
import { VersionWithCommit } from '../../components/version';
import AccountSettings from './account-settings';
import AddressSettings from './address-settings';
import AdvancedSettings from './advanced-settings';
import P2pStats from './p2p-stats';
import ContentOptions from './content-options';
import WalletSettings from './wallet-settings';
import NotificationsSettings from './notifications-settings';
import MediaHostingSettings from './media-hosting-settings';
import styles from './settings.module.css';
import startCase from 'lodash/startCase';

const DebugSettings = import.meta.env.DEV ? lazy(() => import('./debug-settings')) : null;

const CheckForUpdates = () => {
  const { checkForUpdates, loading } = useCheckForUpdates();

  return (
    <div className={styles.checkForUpdates}>
      <Trans
        i18nKey='check_for_updates'
        components={{ 1: <button key='checkForUpdatesButton' className={styles.checkForUpdatesButton} onClick={checkForUpdates} disabled={loading} /> }}
      />
    </div>
  );
};

// prettier-ignore
const availableLanguages = ['ar', 'bn', 'cs', 'da', 'de', 'el', 'en', 'es', 'fa', 'fi', 'fil', 'fr', 'he', 'hi', 'hu', 'id', 'it', 'ja', 'ko', 'mr', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sq', 'sv', 'te', 'th', 'tr', 'uk', 'ur', 'vi', 'zh'];

const LanguageSettings = () => {
  const { t, i18n } = useTranslation();
  const { changeLanguage, language } = i18n;

  const onSelectLanguage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    changeLanguage(e.target.value);
    window.location.reload();
  };

  return (
    <div className={styles.languageSettings}>
      <select value={language} onChange={onSelectLanguage}>
        {availableLanguages.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
      <a href='https://github.com/bitsocialnet/seedit/tree/master/public/translations' target='_blank' rel='noopener noreferrer'>
        {t('contribute_on_github')}
      </a>
    </div>
  );
};

const ThemeSettings = () => {
  const [theme, setTheme] = useTheme();
  const { t } = useTranslation();

  return (
    <select value={theme} onChange={(e) => setTheme(e.target.value)}>
      <option value='light'>{t('light')}</option>
      <option value='dark'>{t('dark')}</option>
    </select>
  );
};

const UiModeSettings = () => {
  const { t } = useTranslation();
  const uiMode = useUiModeStore((state) => state.uiMode);
  const setUiMode = useUiModeStore((state) => state.setUiMode);

  return (
    <select value={uiMode} aria-label={t('interface')} onChange={(e) => isUiMode(e.target.value) && setUiMode(e.target.value)}>
      <option value='modern'>{t('modern_interface')}</option>
      <option value='old'>{t('old_interface')}</option>
    </select>
  );
};

const DisplayNameSetting = () => {
  const { t } = useTranslation();
  const { displayName, setDisplayName, save: saveUsername, saved: savedDisplayName } = useDisplayNameSetting();

  return (
    <div className={styles.displayNameSetting}>
      <div className={styles.usernameInput}>
        <input type='text' placeholder='My Name' value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <button className={styles.button} onClick={saveUsername}>
          {t('save')}
        </button>
        {savedDisplayName && <span className={styles.saved}>{t('saved')}</span>}
      </div>
    </div>
  );
};

const GeneralSettings = () => {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <>
      <div className={styles.category}>
        <span className={styles.categoryTitle}>{t('version')}</span>
        <span className={styles.categorySettings}>
          <div className={styles.version}>
            <VersionWithCommit />
            {window.electronApi?.isElectron && (
              <a className={styles.fullNodeStats} href='http://localhost:50019/webui/' target='_blank' rel='noreferrer'>
                {t('node_stats')}
              </a>
            )}
          </div>
          <CheckForUpdates />
        </span>
      </div>
      <div className={styles.category}>
        <span className={styles.categoryTitle}>{t('interface_language')}</span>
        <span className={styles.categorySettings}>
          <LanguageSettings />
        </span>
      </div>
      <div className={styles.category}>
        <span className={styles.categoryTitle}>{t('theme')}</span>
        <span className={styles.categorySettings}>
          <ThemeSettings />
        </span>
      </div>
      <div className={styles.category}>
        <span className={styles.categoryTitle}>{t('interface')}</span>
        <span className={styles.categorySettings}>
          <UiModeSettings />
        </span>
      </div>
      <div className={`${styles.category} ${location.hash === '#displayName' ? styles.highlightedSetting : ''}`} id='displayName'>
        <span className={styles.categoryTitle}>{t('display_name')}</span>
        <span className={styles.categorySettings}>
          <DisplayNameSetting />
        </span>
      </div>
      <div className={`${styles.category} ${location.hash === '#cryptoAddress' ? styles.highlightedSetting : ''}`} id='cryptoAddress'>
        <span className={styles.categoryTitle}>{t('crypto_address')}</span>
        <span className={styles.categorySettings}>
          <AddressSettings />
        </span>
      </div>
      <div className={`${styles.category} ${location.hash === '#cryptoWallets' ? styles.highlightedSetting : ''}`} id='cryptoWallets'>
        <span className={styles.categoryTitle}>{t('crypto_wallets')}</span>
        <span className={styles.categorySettings}>
          <WalletSettings />
        </span>
      </div>
      <div className={styles.category}>
        <span className={styles.categoryTitle}>{t('notifications')}</span>
        <span className={styles.categorySettings}>
          <NotificationsSettings />
        </span>
      </div>
      <div className={`${styles.category} ${location.hash === '#mediaHosting' ? styles.highlightedSetting : ''}`} id='mediaHosting'>
        <span className={styles.categoryTitle}>{t('media_hosting_providers')}</span>
        <span className={styles.categorySettings}>
          <MediaHostingSettings />
        </span>
      </div>
      <div className={`${styles.category} ${location.hash === '#exportAccount' ? styles.highlightedSetting : ''}`} id='exportBackup'>
        <span className={styles.categoryTitle}>{t('account')}</span>
        <span className={styles.categorySettings}>
          <AccountSettings />
        </span>
      </div>
    </>
  );
};

const Settings = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isInSettingsAdvancedView = isSettingsAdvancedView(location.pathname);
  const isInSettingsP2pStatsView = isSettingsP2pStatsView(location.pathname);
  const isInSettingsContentOptionsView = isSettingsContentOptionsView(location.pathname);
  const isInSettingsDebugView = isSettingsDebugView(location.pathname);
  const account = useAccount();
  const pkcRpc = usePkcRpcSettings();
  const hiddenReviewUpgradeKeys = useSettingsUpgradeReviewStore((state) => state.hiddenReviewUpgradeKeys);
  const reviewUpgradeKeys = useSettingsUpgradeReviewStore((state) => state.reviewUpgradeKeys);
  const settingsUpgradeAccount = account as SettingsUpgradeAccount | undefined;
  const settingsUpgradeKeys =
    settingsUpgradeAccount && pkcRpc?.state !== 'connected'
      ? getReviewableSettingsUpgrades(settingsUpgradeAccount).map((upgrade) => getSettingsUpgradeKey(settingsUpgradeAccount, upgrade))
      : [];
  const visibleSettingsUpgradeKeys = settingsUpgradeKeys.filter((upgradeKey) => !hiddenReviewUpgradeKeys.includes(upgradeKey));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const documentTitle = `${startCase(t('preferences'))} - Seedit`;
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <div className={styles.content}>
      {isInSettingsAdvancedView ? (
        <AdvancedSettings />
      ) : isInSettingsP2pStatsView ? (
        <P2pStats />
      ) : isInSettingsContentOptionsView ? (
        <ContentOptions />
      ) : isInSettingsDebugView && DebugSettings ? (
        <Suspense fallback={null}>
          <DebugSettings />
        </Suspense>
      ) : (
        <GeneralSettings key={account?.id} />
      )}
      {visibleSettingsUpgradeKeys.length > 0 && (
        <output className={styles.settingsUpgradeNotice} aria-live='polite' data-testid='settings-upgrade-review-banner'>
          <span>{t('settings_upgrade_review_notice')}</span>
          {' ['}
          <button type='button' onClick={() => reviewUpgradeKeys(visibleSettingsUpgradeKeys)}>
            {t('settings_upgrade_review_button')}
          </button>
          {']'}
        </output>
      )}
    </div>
  );
};

export default Settings;
