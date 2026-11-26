import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import useAccountBackup from '../../../hooks/use-account-backup';
import styles from './account-settings.module.css';
import { getDisplayAddress } from '../../../lib/utils/address-utils';

const ImportAccountButton = () => {
  const { canImport, importAccountFromFile } = useAccountBackup();

  return (
    <Trans
      i18nKey='import_account_backup'
      components={{
        1: <button key='importAccountButton' type='button' disabled={!canImport} onClick={importAccountFromFile} />,
      }}
    />
  );
};

const ExportAccountButton = () => {
  const { exportAccountToFile } = useAccountBackup();
  const [showExportAccountOptions, setShowExportAccountOptions] = useState(false);
  const [includePkcOptions, setIncludePkcOptions] = useState(true);
  const [includePostHistory, setIncludePostHistory] = useState(true);
  const [includeVoteHistory, setIncludeVoteHistory] = useState(true);

  const handleExportAccount = () => exportAccountToFile({ includePkcOptions, includePostHistory, includeVoteHistory });

  return (
    <>
      <Trans
        i18nKey='download_account_backup'
        components={{
          1: <button key='downloadAccountButton' type='button' onClick={handleExportAccount} />,
        }}
      />
      <span className={styles.exportAccountOptions}>
        <span className={styles.exportAccountOptionsButton} onClick={() => setShowExportAccountOptions(!showExportAccountOptions)}>
          {showExportAccountOptions ? 'hide options' : 'options'}
        </span>
      </span>
      {showExportAccountOptions && (
        <div className={styles.exportAccountOptions}>
          <div className={styles.exportAccountOption}>
            <input type='checkbox' id='includePkcOptions' name='includePkcOptions' checked={includePkcOptions} onChange={(e) => setIncludePkcOptions(e.target.checked)} />
            <label htmlFor='includePkcOptions'>Include PKC options</label>
          </div>
          <div className={styles.exportAccountOption}>
            <input
              type='checkbox'
              id='includePostHistory'
              name='includePostHistory'
              checked={includePostHistory}
              onChange={(e) => setIncludePostHistory(e.target.checked)}
            />
            <label htmlFor='includePostHistory'>Include post history</label>
          </div>
          <div className={styles.exportAccountOption}>
            <input
              type='checkbox'
              id='includeVoteHistory'
              name='includeVoteHistory'
              checked={includeVoteHistory}
              onChange={(e) => setIncludeVoteHistory(e.target.checked)}
            />
            <label htmlFor='includeVoteHistory'>Include vote history</label>
          </div>
        </div>
      )}
    </>
  );
};

const AccountSettings = () => {
  const { t } = useTranslation();
  const { account, accounts, switchAccount, deleteAccountWithConfirmation } = useAccountBackup();

  const accountsOptions = accounts.map((account) => (
    <option key={account?.id} value={account?.name}>
      u/{getDisplayAddress(account?.author?.shortAddress || '')}
    </option>
  ));

  return (
    <span className={styles.categorySettings}>
      <div className={styles.accountAddress}>
        <select value={account?.name} onChange={(e) => switchAccount(e.target.value)}>
          {accountsOptions}
        </select>
        <Link to='/settings/account-data'>{t('edit')}</Link>
      </div>
      <div className={styles.accountData}>
        <div className={styles.accountButtons}>
          <div>
            <ImportAccountButton />
          </div>
          <div>
            <ExportAccountButton />
          </div>
          <div className={styles.deleteAccountBox}>
            <Trans
              i18nKey='delete_this_account'
              components={{
                1: <button key='deleteAccountButton' onClick={() => deleteAccountWithConfirmation(account?.name)} />,
              }}
            />
          </div>
        </div>
      </div>
    </span>
  );
};

export default AccountSettings;
