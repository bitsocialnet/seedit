import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { type Account, useAccount } from '@bitsocial/bitsocial-react-hooks';
import useAccountBackup from '../../hooks/use-account-backup';
import useCheckForUpdates from '../../hooks/use-check-for-updates';
import useCryptoAddressSetting from '../../hooks/use-crypto-address-setting';
import useCryptoWallets from '../../hooks/use-crypto-wallets';
import useDisplayNameSetting from '../../hooks/use-display-name-setting';
import useLocalNotificationsSetting from '../../hooks/use-local-notifications-setting';
import useMediaHostingOptions from '../../hooks/use-media-hosting-options';
import useTheme from '../../hooks/use-theme';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { isUiMode } from '../../lib/utils/ui-mode-utils';
import useUiModeStore from '../../stores/use-ui-mode-store';
import { modernStyles } from '../../components/modern-layout';
import { VersionWithCommit } from '../../components/version';
import { SettingsRow, SettingsSection, SettingsSwitch, settingsStyles } from '../../components/modern-settings-section';
import styles from './modern-settings.module.css';

// prettier-ignore
const AVAILABLE_LANGUAGES = ['ar', 'bn', 'cs', 'da', 'de', 'el', 'en', 'es', 'fa', 'fi', 'fil', 'fr', 'he', 'hi', 'hu', 'id', 'it', 'ja', 'ko', 'mr', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sq', 'sv', 'te', 'th', 'tr', 'uk', 'ur', 'vi', 'zh'];

/** A sentence with one tagged part, such as "<1>import</1> account backup", read as plain text for a button label. */
const TransLabel = ({ i18nKey }: { i18nKey: string }) => <Trans i18nKey={i18nKey} components={{ 1: <span key='part' /> }} />;

const AppSection = () => {
  const { t, i18n } = useTranslation();
  const { checkForUpdates, loading } = useCheckForUpdates();
  const [theme, setTheme] = useTheme();
  const uiMode = useUiModeStore((state) => state.uiMode);
  const setUiMode = useUiModeStore((state) => state.setUiMode);

  return (
    <SettingsSection title={t('general')}>
      <div className={settingsStyles.rows}>
        <SettingsRow label={t('version')}>
          <VersionWithCommit />
          {window.electronApi?.isElectron && (
            <a className={settingsStyles.link} href='http://localhost:50019/webui/' target='_blank' rel='noreferrer'>
              {t('node_stats')}
            </a>
          )}
          <button type='button' className={`${modernStyles.secondaryButton} ${settingsStyles.button}`} onClick={() => void checkForUpdates()} disabled={loading}>
            <TransLabel i18nKey='check_for_updates' />
          </button>
        </SettingsRow>
        <SettingsRow
          label={t('interface_language')}
          htmlFor='modern-settings-language'
          hint={
            <a className={settingsStyles.link} href='https://github.com/bitsocialnet/seedit/tree/master/public/translations' target='_blank' rel='noopener noreferrer'>
              {t('contribute_on_github')}
            </a>
          }
        >
          <select
            id='modern-settings-language'
            className={settingsStyles.select}
            value={i18n.language}
            onChange={(event) => {
              i18n.changeLanguage(event.target.value);
              window.location.reload();
            }}
          >
            {AVAILABLE_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </SettingsRow>
        <SettingsRow label={t('theme')}>
          <div className={styles.choices} role='radiogroup' aria-label={t('theme')}>
            {(['light', 'dark'] as const).map((value) => (
              <label key={value} className={styles.choice}>
                <input type='radio' name='modern-settings-theme' value={value} checked={theme === value} onChange={() => setTheme(value)} />
                <span className={modernStyles.sentenceCase}>{t(value)}</span>
              </label>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label={t('interface')}>
          <div className={styles.choices} role='radiogroup' aria-label={t('interface')}>
            {(['modern', 'old'] as const).map((value) => (
              <label key={value} className={styles.choice}>
                <input type='radio' name='modern-settings-interface' value={value} checked={uiMode === value} onChange={() => isUiMode(value) && setUiMode(value)} />
                <span className={modernStyles.sentenceCase}>{value === 'modern' ? t('modern_interface') : t('old_interface')}</span>
              </label>
            ))}
          </div>
        </SettingsRow>
      </div>
    </SettingsSection>
  );
};

const DisplayNameSection = () => {
  const { t } = useTranslation();
  const { displayName, setDisplayName, save, saved } = useDisplayNameSetting();
  return (
    <SettingsSection id='displayName' title={t('display_name')}>
      <form
        className={settingsStyles.controls}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <input
          className={settingsStyles.input}
          aria-label={t('display_name')}
          placeholder='My Name'
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <button type='submit' className={`${modernStyles.primaryButton} ${settingsStyles.button}`}>
          <span className={modernStyles.sentenceCase}>{t('save')}</span>
        </button>
        {saved && (
          <span className={`${settingsStyles.status} ${settingsStyles.statusSuccess} ${modernStyles.sentenceCase}`} role='status'>
            {t('saved')}
          </span>
        )}
      </form>
    </SettingsSection>
  );
};

const STATUS_CLASSES = { error: settingsStyles.statusError, pending: settingsStyles.statusPending, success: settingsStyles.statusSuccess, neutral: '' };

const CryptoAddressSection = () => {
  const { t } = useTranslation();
  const { cryptoAddress, setCryptoAddress, status, check, save, saved, signerAddress } = useCryptoAddressSetting();
  return (
    <SettingsSection id='cryptoAddress' title={t('crypto_address')}>
      <div className={settingsStyles.controls}>
        <input
          className={settingsStyles.input}
          aria-label={t('crypto_address')}
          placeholder='myaddress.bso'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck={false}
          value={getDisplayAddress(cryptoAddress)}
          onChange={(event) => setCryptoAddress(event.target.value)}
        />
        <button type='button' className={`${modernStyles.secondaryButton} ${settingsStyles.button}`} onClick={check}>
          <span className={modernStyles.sentenceCase}>{t('check')}</span>
        </button>
        <button type='button' className={`${modernStyles.primaryButton} ${settingsStyles.button}`} onClick={() => void save()}>
          <span className={modernStyles.sentenceCase}>{t('save')}</span>
        </button>
        {saved && <span className={`${settingsStyles.status} ${settingsStyles.statusSuccess} ${modernStyles.sentenceCase}`}>{t('saved')}</span>}
      </div>
      <p className={`${settingsStyles.status} ${STATUS_CLASSES[status.tone]}`} role='status'>
        <span className={modernStyles.sentenceCase}>{status.text}</span>
      </p>
      <details className={styles.help}>
        <summary>How to use a .bso address</summary>A <code>.bso</code> address is an ENS name you own, shown by Seedit with a <code>.bso</code> ending instead of{' '}
        <code>.eth</code>. To use one as your account name:
        <ol>
          <li>
            Register a name (e.g. <code>yourname.eth</code>) at{' '}
            <a className={settingsStyles.link} href='https://app.ens.domains/' target='_blank' rel='noopener noreferrer'>
              app.ens.domains
            </a>
            .
          </li>
          <li>
            Open that name on ENS and go to <strong>Records</strong> → <strong>Edit Records</strong>.
          </li>
          <li>
            Add a <strong>text record</strong> named <code>bitsocial</code> and paste this account&apos;s public key as its value: <code>{signerAddress}</code>
          </li>
          <li>
            Come back here, type your name ending in <code>.bso</code> (e.g. <code>yourname.bso</code>) in the field above, press <strong>Check</strong> to confirm it
            points to this account, then press <strong>Save</strong>.
          </li>
        </ol>
      </details>
    </SettingsSection>
  );
};

const WalletsForm = ({ account }: { account: Account }) => {
  const { t } = useTranslation();
  const { wallets, setWalletProperty, addWallet, removeWallet, save, copyMessageToSign, hasCopied } = useCryptoWallets(account);

  return (
    <>
      {wallets.map((wallet, index) => (
        <div key={index} className={styles.wallet}>
          <div className={styles.walletHeader}>
            <span className={modernStyles.sentenceCase}>{t('wallet_number', { index: index + 1 })}</span>
            <button type='button' className={`${modernStyles.secondaryButton} ${settingsStyles.button} ${settingsStyles.danger}`} onClick={() => removeWallet(index)}>
              {t('remove')}
            </button>
          </div>
          <label className={settingsStyles.field}>
            {t('chain_ticker')}
            <input
              className={settingsStyles.input}
              autoCapitalize='off'
              spellCheck={false}
              placeholder='eth'
              value={wallet.chainTicker}
              onChange={(event) => setWalletProperty(index, 'chainTicker', event.target.value)}
            />
          </label>
          <label className={settingsStyles.field}>
            {t('wallet_address')}
            <input
              className={settingsStyles.input}
              autoCapitalize='off'
              spellCheck={false}
              placeholder='0x...'
              value={wallet.address}
              onChange={(event) => setWalletProperty(index, 'address', event.target.value)}
            />
          </label>
          <p className={settingsStyles.status}>
            <Trans
              i18nKey='copy_message_etherscan'
              values={{ copy: hasCopied ? t('copied') : t('copy') }}
              components={{
                1: <button key='copy' type='button' className={`${settingsStyles.textButton} ${settingsStyles.link}`} onClick={() => copyMessageToSign(index)} />,
                2: <a key='etherscan' className={settingsStyles.link} href='https://etherscan.io/verifiedSignatures' target='_blank' rel='noopener noreferrer' />,
              }}
            />
          </p>
          <label className={settingsStyles.field}>
            Timestamp
            <input
              className={settingsStyles.input}
              autoComplete='off'
              value={wallet.timestamp || ''}
              onChange={(event) => setWalletProperty(index, 'timestamp', Number(event.target.value))}
            />
          </label>
          <label className={settingsStyles.field}>
            <span className={modernStyles.sentenceCase}>{t('paste_signature')}</span>
            <input
              className={settingsStyles.input}
              autoCapitalize='off'
              spellCheck={false}
              placeholder='0x...'
              value={wallet.signature}
              onChange={(event) => setWalletProperty(index, 'signature', event.target.value)}
            />
          </label>
          <div className={settingsStyles.controls}>
            <button
              type='button'
              className={`${modernStyles.primaryButton} ${settingsStyles.button}`}
              onClick={() => {
                save();
                alert(t('saved'));
              }}
            >
              <span className={modernStyles.sentenceCase}>{t('save')}</span>
            </button>
          </div>
        </div>
      ))}
      <div className={settingsStyles.controls}>
        <button type='button' className={`${modernStyles.secondaryButton} ${settingsStyles.button}`} onClick={addWallet}>
          <span className={modernStyles.sentenceCase}>
            <TransLabel i18nKey='add_wallet' />
          </span>
        </button>
      </div>
    </>
  );
};

const WalletsSection = () => {
  const { t } = useTranslation();
  const account = useAccount();
  return (
    <SettingsSection
      id='cryptoWallets'
      title={t('crypto_wallets')}
      description='Link crypto wallets to your account by proving ownership through signed messages. Communities can verify your token/NFT holdings to grant posting privileges or special access.'
    >
      {account && <WalletsForm account={account} />}
    </SettingsSection>
  );
};

const NotificationsSection = () => {
  const { t } = useTranslation();
  const { enabled, setNotificationsEnabled, isDisabled, isNotSupported, isRequesting, showDenied, showSuccess, deniedMessage, showTestNotification } =
    useLocalNotificationsSetting();
  return (
    <SettingsSection title={t('notifications')}>
      <div className={settingsStyles.rows}>
        <SettingsSwitch
          id='modern-settings-notifications'
          label={t('new_replies_received')}
          checked={enabled}
          disabled={isDisabled}
          onChange={(checked) => void setNotificationsEnabled(checked)}
        />
      </div>
      <p className={settingsStyles.status} role='status'>
        {isNotSupported && <span className={settingsStyles.statusError}>Notifications are not supported on this system.</span>}
        {showDenied && <span className={settingsStyles.statusError}>{deniedMessage}</span>}
        {isRequesting && <span className={settingsStyles.statusPending}>Click "Allow" to enable notifications</span>}
        {showSuccess && (
          <span className={settingsStyles.statusSuccess}>
            Success! You're done.{' '}
            <button type='button' className={`${settingsStyles.textButton} ${settingsStyles.link}`} onClick={showTestNotification}>
              Test
            </button>
          </span>
        )}
      </p>
    </SettingsSection>
  );
};

const MediaHostingSection = () => {
  const { t } = useTranslation();
  const { runtime, providers, mode, preferredProvider, isUnavailable, isSelectable, selectRandom, selectNone, selectProvider } = useMediaHostingOptions();
  return (
    <SettingsSection id='mediaHosting' title={t('media_hosting_providers')} description={runtime === 'web' ? t('media_hosting_more_providers_in_apps') : undefined}>
      <div className={styles.optionList} role='radiogroup' aria-label={t('media_hosting_providers')}>
        {providers.length > 1 && (
          <label className={styles.option}>
            <input type='radio' name='modern-media-hosting' checked={mode === 'random'} onChange={selectRandom} />
            <span className={styles.optionText}>{t('media_hosting_random')}</span>
          </label>
        )}
        {providers.map((provider) => (
          <label key={provider.id} className={styles.option}>
            <input
              type='radio'
              name='modern-media-hosting'
              checked={mode === 'preferred' && preferredProvider === provider.id}
              disabled={!isSelectable(provider.id)}
              onChange={() => selectProvider(provider.id)}
            />
            <span className={styles.optionText}>
              {provider.label}{' '}
              <a className={settingsStyles.link} href={provider.homepageUrl} target='_blank' rel='noopener noreferrer'>
                {new URL(provider.homepageUrl).host}
              </a>
              <span className={settingsStyles.rowHint}>{isUnavailable(provider.id) ? t('media_hosting_provider_unavailable') : provider.fileKinds.join(', ')}</span>
            </span>
          </label>
        ))}
        <label className={styles.option}>
          <input type='radio' name='modern-media-hosting' checked={mode === 'none'} onChange={selectNone} />
          <span className={styles.optionText}>
            {t('media_hosting_none')}
            <span className={settingsStyles.rowHint}>{t('media_hosting_none_tip')}</span>
          </span>
        </label>
      </div>
    </SettingsSection>
  );
};

const AccountSection = () => {
  const { t } = useTranslation();
  const { account, accounts, canImport, switchAccount, importAccountFromFile, exportAccountToFile, deleteAccountWithConfirmation } = useAccountBackup();
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportOptions, setExportOptions] = useState({ includePkcOptions: true, includePostHistory: true, includeVoteHistory: true });
  const exportOptionLabels: [keyof typeof exportOptions, string][] = [
    ['includePkcOptions', 'Include PKC options'],
    ['includePostHistory', 'Include post history'],
    ['includeVoteHistory', 'Include vote history'],
  ];

  return (
    <SettingsSection id='exportAccount' title={t('account')}>
      <div className={settingsStyles.rows}>
        <SettingsRow label={t('account')} htmlFor='modern-settings-account'>
          <select id='modern-settings-account' className={settingsStyles.select} value={account?.name} onChange={(event) => void switchAccount(event.target.value)}>
            {accounts.map((option) => (
              <option key={option?.id} value={option?.name}>
                u/{getDisplayAddress(option?.author?.shortAddress || '')}
              </option>
            ))}
          </select>
          <Link to='/settings/account-data' className={settingsStyles.link}>
            <span className={modernStyles.sentenceCase}>{t('edit')}</span>
          </Link>
        </SettingsRow>
        <div className={settingsStyles.row}>
          <div className={settingsStyles.controls}>
            <button type='button' className={`${modernStyles.secondaryButton} ${settingsStyles.button}`} disabled={!canImport} onClick={importAccountFromFile}>
              <span className={modernStyles.sentenceCase}>
                <TransLabel i18nKey='import_account_backup' />
              </span>
            </button>
            <button type='button' className={`${modernStyles.secondaryButton} ${settingsStyles.button}`} onClick={() => void exportAccountToFile(exportOptions)}>
              <span className={modernStyles.sentenceCase}>
                <TransLabel i18nKey='download_account_backup' />
              </span>
            </button>
            <button
              type='button'
              className={`${settingsStyles.textButton} ${settingsStyles.link}`}
              aria-expanded={showExportOptions}
              onClick={() => setShowExportOptions(!showExportOptions)}
            >
              <span className={modernStyles.sentenceCase}>{showExportOptions ? t('hide_options') : t('options')}</span>
            </button>
          </div>
          {showExportOptions && (
            <div className={styles.exportOptions}>
              {exportOptionLabels.map(([key, label]) => (
                <label key={key}>
                  <input type='checkbox' checked={exportOptions[key]} onChange={(event) => setExportOptions({ ...exportOptions, [key]: event.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className={settingsStyles.row}>
          <button
            type='button'
            className={`${modernStyles.secondaryButton} ${settingsStyles.button} ${settingsStyles.danger}`}
            onClick={() => deleteAccountWithConfirmation(account?.name)}
          >
            <span className={modernStyles.sentenceCase}>
              <TransLabel i18nKey='delete_this_account' />
            </span>
          </button>
        </div>
      </div>
    </SettingsSection>
  );
};

/** The main preferences: app, identity, wallets, notifications, uploads, and the account itself. */
const GeneralSettings = () => (
  <>
    <AppSection />
    <DisplayNameSection />
    <CryptoAddressSection />
    <WalletsSection />
    <NotificationsSection />
    <MediaHostingSection />
    <AccountSection />
  </>
);

export default GeneralSettings;
