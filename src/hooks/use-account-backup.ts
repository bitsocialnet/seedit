import { useTranslation } from 'react-i18next';
import { exportAccount, importAccount, setActiveAccount, useAccount, useAccounts } from '@bitsocial/bitsocial-react-hooks';
import { isElectronRuntime } from '../lib/p2p-browser-config';
import { getEditableAccountData } from '../lib/utils/account-data-utils';
import { getImportedAccountActiveName, processImportedAccount, rememberImportedAccountAddress } from '../lib/utils/account-import-utils';
import { exportFile } from '../lib/utils/file-export-utils';
import { deleteAccountAfterStarterWrites } from '../lib/utils/starter-account-persistence';

export interface AccountExportOptions {
  includePkcOptions: boolean;
  includePostHistory: boolean;
  includeVoteHistory: boolean;
}

const reportError = (error: unknown) => {
  if (error instanceof Error) {
    alert(error.message);
    console.log(error);
  } else {
    console.error('An unknown error occurred:', error);
  }
};

/** Switching, importing, exporting, and deleting accounts; both interfaces' settings pages use it. */
const useAccountBackup = () => {
  const { t } = useTranslation();
  const account = useAccount();
  const { accounts, state: accountsState } = useAccounts();

  /** Asks for a backup file and imports it as a new account, which becomes the active one. */
  const importAccountFromFile = () => {
    const isElectron = isElectronRuntime(window);
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';

    fileInput.onchange = async (event) => {
      try {
        const files = (event.target as HTMLInputElement).files;
        if (!files || files.length === 0) throw new Error('No file selected.');

        const reader = new FileReader();
        reader.onload = async (loadEvent) => {
          try {
            const fileContent = loadEvent.target?.result ?? reader.result;
            if (typeof fileContent !== 'string') throw new Error('File content is not a string.');
            // Process the imported account with platform-appropriate PKC options.
            const transformedAccountString = processImportedAccount(fileContent, isElectron);
            const newAccount = JSON.parse(transformedAccountString);
            const importedAccountActiveName = getImportedAccountActiveName(newAccount.account?.name, accounts);
            await importAccount(transformedAccountString);

            if (newAccount.account?.author?.address) rememberImportedAccountAddress(newAccount.account.author.address);

            // Hooks suffix duplicate account names during import, so activate the same resolved name.
            if (importedAccountActiveName) await setActiveAccount(importedAccountActiveName);

            alert(`Imported ${importedAccountActiveName}`);
          } catch (error) {
            reportError(error);
          }
        };
        reader.readAsText(files[0]);
      } catch (error) {
        reportError(error);
      }
    };

    fileInput.click();
  };

  const exportAccountToFile = async ({ includePkcOptions, includePostHistory, includeVoteHistory }: AccountExportOptions) => {
    try {
      if (!account) throw new Error('No account available to export');

      const exportedAccount = JSON.parse(await exportAccount());

      // exportAccount might not include pkcOptions, so they come from useAccount()
      const accountDataToInclude = getEditableAccountData(account);
      if (!includePkcOptions) delete accountDataToInclude.pkcOptions;
      exportedAccount.account = accountDataToInclude;

      if (!includePostHistory) {
        delete exportedAccount.accountComments;
        delete exportedAccount.accountEdits;
      }
      if (!includeVoteHistory) delete exportedAccount.accountVotes;

      await exportFile({ content: JSON.stringify(exportedAccount, null, 2), fileName: `${account.name}.json`, mimeType: 'application/json' });
    } catch (error) {
      reportError(error);
    }
  };

  /** Deletes the account after two confirmations; it cannot be undone. */
  const deleteAccountWithConfirmation = (accountName: string | undefined) => {
    if (!accountName) return;
    if (window.confirm(t('delete_confirm', { value: accountName, interpolation: { escapeValue: false } })) && window.confirm(t('double_confirm'))) {
      // waits for pending starter subscription writes, which would otherwise recreate the deleted account
      deleteAccountAfterStarterWrites(accountName).catch((error) => {
        console.error('Failed to delete account:', error);
        alert(error instanceof Error ? error.message : String(error));
      });
    }
  };

  return {
    account,
    accounts,
    canImport: accountsState === 'succeeded',
    switchAccount: (accountName: string) => setActiveAccount(accountName),
    importAccountFromFile,
    exportAccountToFile,
    deleteAccountWithConfirmation,
  };
};

export default useAccountBackup;
