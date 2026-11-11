import { deleteAccount } from '@bitsocial/bitsocial-react-hooks';
import accountsDatabase from '@bitsocial/bitsocial-react-hooks/dist/stores/accounts/accounts-database.js';
import accountsStore from '@bitsocial/bitsocial-react-hooks/dist/stores/accounts/accounts-store.js';
import { persistRebasedStarterAccount, type StarterAccount } from './starter-account';

const getStoreAccountById = (accountId: string): StarterAccount | undefined => accountsStore.getState().accounts[accountId] as StarterAccount | undefined;

const setStoreAccountIfCurrent = (accountId: string, expectedAccount: StarterAccount, nextAccount: StarterAccount) => {
  accountsStore.setState((state) => {
    if (state.accounts[accountId] !== expectedAccount) return {};
    return {
      accounts: {
        ...state.accounts,
        [accountId]: nextAccount,
      },
    };
  });
};

// These writes go straight to the accounts database, so the hooks' deleteAccount does not order itself against them.
const pendingWriteAccountIds = new Map<Promise<void>, string>();
const accountDeletions = new Map<string, Promise<void>>();

export const persistStarterAccountUpdate = (accountId: string, computeAccount: (account: StarterAccount) => StarterAccount): Promise<void> => {
  if (accountDeletions.has(accountId)) return Promise.reject(new Error('Account disappeared while updating default communities'));
  const write = persistRebasedStarterAccount({
    getCurrentAccount: () => getStoreAccountById(accountId),
    computeAccount,
    persistAccount: (account) => accountsDatabase.addAccount(account),
    updateAccountIfCurrent: (expectedAccount, nextAccount) => setStoreAccountIfCurrent(accountId, expectedAccount, nextAccount),
  });
  pendingWriteAccountIds.set(write, accountId);
  const forgetWrite = () => pendingWriteAccountIds.delete(write);
  write.then(forgetWrite, forgetWrite);
  return write;
};

/** Delete an account once its in-flight default-community writes have landed, so none of them can restore the deleted database row. */
export const deleteAccountAfterStarterWrites = (accountName: string): Promise<void> => {
  const accountId = accountsStore.getState().accountNamesToAccountIds[accountName];
  if (!accountId) return deleteAccount(accountName);
  // A repeated request joins the deletion in progress, so the write guard stays up until that deletion ends.
  const deletionInProgress = accountDeletions.get(accountId);
  if (deletionInProgress) return deletionInProgress;
  const deletion = (async () => {
    try {
      const pendingWrites = [...pendingWriteAccountIds].filter(([, writeAccountId]) => writeAccountId === accountId).map(([write]) => write);
      await Promise.allSettled(pendingWrites);
      await deleteAccount(accountName);
    } finally {
      accountDeletions.delete(accountId);
    }
  })();
  accountDeletions.set(accountId, deletion);
  return deletion;
};
