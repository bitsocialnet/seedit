import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { createAccount, deleteAccount, exportAccount, importAccount, setActiveAccount, useAccount, useAccounts } from '@bitsocialnet/bitsocial-react-hooks';
import { processImportedAccount } from '../../../lib/utils/account-import-utils';
import { exportFile } from '../../../lib/utils/file-export-utils';
import styles from './account-settings.module.css';

const CreateAccountButton = () => {
  const { accounts } = useAccounts();
  const switchToNewAccountRef = useRef(false);

  useEffect(() => {
    if (switchToNewAccountRef.current && accounts.length > 0) {
      const lastAccount = accounts[accounts.length - 1];
      setActiveAccount(lastAccount.name);
      switchToNewAccountRef.current = false;
    }
  }, [accounts]);

  const handleCreateAccount = async () => {
    try {
      switchToNewAccountRef.current = true;
      await createAccount();
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
    <Trans
      i18nKey='create_new_account'
      components={{
        1: <button key='createNewAccountButton' onClick={handleCreateAccount} />,
      }}
    />
  );
};

const ImportAccountButton = () => {
  const isElectron = window.electronApi?.isElectron === true;

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
            const fileContent = e.target!.result;
            if (typeof fileContent !== 'string') {
              throw new Error('File content is not a string.');
            }
            // Process the imported account with platform-appropriate plebbit options
            const transformedAccountString = processImportedAccount(fileContent, isElectron);
            const newAccount = JSON.parse(transformedAccountString);
            await importAccount(transformedAccountString);

            // Store the imported account's address
            if (newAccount.account?.author?.address) {
              localStorage.setItem('importedAccountAddress', newAccount.account.author.address);
            }

            // Set the new account as active before reloading
            if (newAccount.account?.name) {
              await setActiveAccount(newAccount.account.name);
            }

            alert(`Imported ${newAccount.account?.name}`);
            window.location.reload();
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
        1: <button key='importAccountButton' onClick={handleImportAccount} />,
      }}
    />
  );
};

const ExportAccountButton = () => {
  const account = useAccount();
  const [showExportAccountOptions, setShowExportAccountOptions] = useState(false);
  const [includePlebbitOptions, setIncludePlebbitOptions] = useState(true);
  const [includePostHistory, setIncludePostHistory] = useState(true);
  const [includeVoteHistory, setIncludeVoteHistory] = useState(true);

  const handleExportAccount = async () => {
    try {
      if (!account) {
        throw new Error('No account available to export');
      }

      const accountString = await exportAccount();
      const exportedAccount = JSON.parse(accountString);

      // exportAccount might not include plebbitOptions, so we need to include it from useAccount()
      let accountDataToInclude;
      if (includePlebbitOptions) {
        const { plebbit: _plebbit, ...completeAccountData } = account;
        accountDataToInclude = completeAccountData;
      } else {
        const { plebbit: _plebbit, plebbitOptions: _plebbitOptions, ...completeAccountData } = account;
        accountDataToInclude = completeAccountData;
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
        i18nKey='export_account_backup'
        components={{
          1: <button key='exportAccountButton' onClick={handleExportAccount} />,
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
            <input
              type='checkbox'
              id='includePlebbitOptions'
              name='includePlebbitOptions'
              checked={includePlebbitOptions}
              onChange={(e) => setIncludePlebbitOptions(e.target.checked)}
            />
            <label htmlFor='includePlebbitOptions'>Include plebbit options</label>
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
      u/{account?.author?.shortAddress}
    </option>
  ));

  const _deleteAccount = (accountName: string) => {
    if (!accountName) {
      return;
    } else if (window.confirm(t('delete_confirm', { value: accountName, interpolation: { escapeValue: false } }))) {
      if (window.confirm(t('double_confirm'))) {
        deleteAccount(accountName);
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
      <div className={styles.createAccount}>
        <CreateAccountButton />
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
