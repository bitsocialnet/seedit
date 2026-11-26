import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAccount, usePkcRpcSettings } from '@bitsocial/bitsocial-react-hooks';
import { getReviewableSettingsUpgrades, getSettingsUpgradeKey, type SettingsUpgradeAccount } from '../../lib/settings-upgrades';
import { isSettingsAdvancedView, isSettingsContentOptionsView, isSettingsP2pStatsView } from '../../lib/utils/view-utils';
import useSettingsUpgradeReviewStore from '../../stores/use-settings-upgrade-review-store';
import { ModernColumns, modernStyles } from '../../components/modern-layout';
import { settingsStyles } from '../../components/modern-settings-section';
import { ModernUserTabs } from '../../components/modern-user-profile';
import AdvancedSettings from './advanced-settings';
import ContentSettings from './content-settings';
import GeneralSettings from './general-settings';
import P2pStats from './p2p-stats';

/** Offers to review settings that changed defaults since the account saved them, unless a full node manages them. */
const SettingsUpgradeNotice = () => {
  const { t } = useTranslation();
  const account = useAccount() as SettingsUpgradeAccount | undefined;
  const pkcRpc = usePkcRpcSettings();
  const hiddenReviewUpgradeKeys = useSettingsUpgradeReviewStore((state) => state.hiddenReviewUpgradeKeys);
  const reviewUpgradeKeys = useSettingsUpgradeReviewStore((state) => state.reviewUpgradeKeys);
  const upgradeKeys = account && pkcRpc?.state !== 'connected' ? getReviewableSettingsUpgrades(account).map((upgrade) => getSettingsUpgradeKey(account, upgrade)) : [];
  const visibleUpgradeKeys = upgradeKeys.filter((upgradeKey) => !hiddenReviewUpgradeKeys.includes(upgradeKey));
  if (visibleUpgradeKeys.length === 0) return null;

  return (
    <output className={settingsStyles.notice} aria-live='polite' data-testid='settings-upgrade-review-banner'>
      <span className={modernStyles.sentenceCase}>{t('settings_upgrade_review_notice')}</span>
      <button type='button' className={`${modernStyles.primaryButton} ${settingsStyles.button}`} onClick={() => reviewUpgradeKeys(visibleUpgradeKeys)}>
        <span className={modernStyles.sentenceCase}>{t('settings_upgrade_review_button')}</span>
      </button>
    </output>
  );
};

/** Preferences, content options, and advanced P2P options in the modern interface. */
const ModernSettings = () => {
  const { t } = useTranslation();
  const { pathname, hash } = useLocation();
  const accountId: string | undefined = useAccount()?.id;
  const page = isSettingsAdvancedView(pathname) ? 'advanced' : isSettingsContentOptionsView(pathname) ? 'content' : isSettingsP2pStatsView(pathname) ? 'p2p' : 'general';

  const title = `${t('preferences').charAt(0).toUpperCase()}${t('preferences').slice(1)}`;
  useEffect(() => {
    document.title = `${title} - Seedit`;
  }, [title]);
  // A link to a section scrolls to it instead.
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [page, hash]);

  const tabs = [
    { path: '/settings', label: t('general'), isActive: page === 'general' },
    { path: '/settings/content-options', label: t('content_options'), isActive: page === 'content' },
    { path: '/settings/advanced', label: t('advanced'), isActive: page === 'advanced' },
    // Sentence case would make the leading acronym read "P2p".
    { path: '/settings/p2p-stats', label: t('p2p_stats').replace(/^p2p/i, 'P2P'), isActive: page === 'p2p' },
  ];

  return (
    <ModernColumns>
      <header className={settingsStyles.header}>
        <h1 className={settingsStyles.heading}>{title}</h1>
      </header>
      <ModernUserTabs tabs={tabs} label={title} />
      <SettingsUpgradeNotice />
      {/* Keyed by account, so drafts start over from the account a switch makes active. */}
      {page === 'advanced' ? (
        <AdvancedSettings key={accountId} />
      ) : (
        <div className={settingsStyles.sections} key={accountId}>
          {page === 'content' ? <ContentSettings /> : page === 'p2p' ? <P2pStats /> : <GeneralSettings />}
        </div>
      )}
    </ModernColumns>
  );
};

export default ModernSettings;
