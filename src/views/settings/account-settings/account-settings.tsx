import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { exportAccount, importAccount, setActiveAccount, useAccount, useAccounts } from '@bitsocial/bitsocial-react-hooks';
import { getImportedAccountActiveName, processImportedAccount, rememberImportedAccountAddress } from '../../../lib/utils/account-import-utils';
import { exportFile } from '../../../lib/utils/file-export-utils';
import styles from './account-settings.module.css';
import { getDisplayAddress } from '../../../lib/utils/address-utils';
import { getEditableAccountData } from '../../../lib/utils/account-data-utils';
import { isElectronRuntime } from '../../../lib/p2p-browser-config';
import { deleteAccountAfterStarterWrites } from '../../../lib/utils/starter-account-persistence';

const ImportAccountButton = () => {
  const isElectron = isElectronRuntime(window);
  const { accounts, state: accountsState } = useAccounts();

  const handleImportAccount = async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';

    // Handle file selection
    fileInput.onchange = async (event) => {
      try {
        const files = (event.target as HTMLInputElement).files;
        if (!files || files.length === 0) {
          throw new Error('No file selected.');
        }
        const file = files[0];

        // Read the file content
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const fileContent = e.target?.result ?? reader.result;
            if (typeof fileContent !== 'string') {
              throw new Error('File content is not a string.');
            }
            // Process the imported account with platform-appropriate PKC options.
            const transformedAccountString = processImportedAccount(fileContent, isElectron);
            const newAccount = JSON.parse(transformedAccountString);
            const importedAccountActiveName = getImportedAccountActiveName(newAccount.account?.name, accounts);
            await importAccount(transformedAccountString);

            // Store the imported account's address
            if (newAccount.account?.author?.address) {
              rememberImportedAccountAddress(newAccount.account.author.address);
            }

            // Hooks suffix duplicate account names during import, so activate the same resolved name.
            if (importedAccountActiveName) {
              await setActiveAccount(importedAccountActiveName);
            }

            alert(`Imported ${importedAccountActiveName}`);
          } catch (error) {
            if (error instanceof Error) {
              alert(error.message);
              console.log(error);
            } else {
              console.error('An unknown error occurred:', error);
            }
          }
        };
        reader.readAsText(file);
      } catch (error) {
        if (error instanceof Error) {
          alert(error.message);
          console.log(error);
        } else {
          console.error('An unknown error occurred:', error);
        }
      }
    };

    // Trigger file selection dialog
    fileInput.click();
  };

  return (
    <Trans
      i18nKey='import_account_backup'
      components={{
        1: <button key='importAccountButton' type='button' disabled={accountsState !== 'succeeded'} onClick={handleImportAccount} />,
      }}
    />
  );
};

const ExportAccountButton = () => {
  const account = useAccount();
  const [showExportAccountOptions, setShowExportAccountOptions] = useState(false);
  const [includePkcOptions, setIncludePkcOptions] = useState(true);
  const [includePostHistory, setIncludePostHistory] = useState(true);
  const [includeVoteHistory, setIncludeVoteHistory] = useState(true);

  const handleExportAccount = async () => {
    try {
      if (!account) {
        throw new Error('No account available to export');
      }

      const accountString = await exportAccount();
      const exportedAccount = JSON.parse(accountString);

      // exportAccount might not include pkcOptions, so we need to include it from useAccount()
      const accountDataToInclude = getEditableAccountData(account);
      if (!includePkcOptions) {
        delete accountDataToInclude.pkcOptions;
      }
      exportedAccount.account = accountDataToInclude;

      if (!includePostHistory) {
        delete exportedAccount.accountComments;
        delete exportedAccount.accountEdits;
      }

      if (!includeVoteHistory) {
        delete exportedAccount.accountVotes;
      }

      const formattedAccountJson = JSON.stringify(exportedAccount, null, 2);

      // Use cross-platform export utility
      await exportFile({
        content: formattedAccountJson,
        fileName: `${account.name}.json`,
        mimeType: 'application/json',
      });
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
        console.log(error);
      } else {
        console.error('An unknown error occurred:', error);
      }
    }
  };

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

  const account = useAccount();
  const { accounts } = useAccounts();

  const accountsOptions = accounts.map((account) => (
    <option key={account?.id} value={account?.name}>
      u/{getDisplayAddress(account?.author?.shortAddress || '')}
    </option>
  ));

  const _deleteAccount = (accountName: string) => {
    if (!accountName) {
      return;
    } else if (window.confirm(t('delete_confirm', { value: accountName, interpolation: { escapeValue: false } }))) {
      if (window.confirm(t('double_confirm'))) {
        deleteAccountAfterStarterWrites(accountName).catch((error) => {
          console.error('Failed to delete account:', error);
          alert(error instanceof Error ? error.message : String(error));
        });
      }
    }
  };

  return (
    <span className={styles.categorySettings}>
      <div className={styles.accountAddress}>
        <select value={account?.name} onChange={(e) => setActiveAccount(e.target.value)}>
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
                1: <button key='deleteAccountButton' onClick={() => _deleteAccount(account?.name)} />,
              }}
            />
          </div>
        </div>
      </div>
    </span>
  );
};

export default AccountSettings;
