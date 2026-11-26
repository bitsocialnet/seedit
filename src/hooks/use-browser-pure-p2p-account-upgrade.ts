import { useEffect, useRef } from 'react';
import { createAccount, setAccount, setActiveAccount, useAccount, useAccounts } from '@bitsocial/bitsocial-react-hooks';
import { getBrowserPureP2PAccountOptions, shouldUpgradeBrowserPureP2PAccount } from '../lib/p2p-runtime';

type AccountShape = Record<string, unknown> & {
  id?: string;
  name?: string;
};

export const useBrowserPureP2PAccountUpgrade = () => {
  const account = useAccount() as AccountShape | undefined;
  const { accounts = [], state: accountsState } = useAccounts();
  const activeAccountRecoveryNameRef = useRef<string | undefined>(undefined);
  const missingAccountRecoveryStartedRef = useRef(false);
  const upgradeAccountIdRef = useRef<string | undefined>(undefined);
  const firstAccountName = accounts[0]?.name;

  useEffect(() => {
    const accountsStoreInitializing = window.BITSOCIAL_REACT_HOOKS_ACCOUNTS_STORE_INITIALIZING === true;

    if (account?.id) {
      // Recovery finished, so a later deletion of this account must be able to recover again.
      missingAccountRecoveryStartedRef.current = false;
      activeAccountRecoveryNameRef.current = undefined;
      return;
    }

    if (accounts.length === 0) {
      if (accountsStoreInitializing || missingAccountRecoveryStartedRef.current) return;

      missingAccountRecoveryStartedRef.current = true;
      void createAccount().catch((error) => {
        missingAccountRecoveryStartedRef.current = false;
        console.error('Failed to recover missing browser account', error);
      });
      return;
    }

    if (!firstAccountName) return;
    if (activeAccountRecoveryNameRef.current === firstAccountName) return;

    activeAccountRecoveryNameRef.current = firstAccountName;
    void setActiveAccount(firstAccountName).catch((error) => {
      activeAccountRecoveryNameRef.current = undefined;
      console.error('Failed to recover missing active browser account', error);
    });
  }, [account?.id, accounts.length, accountsState, firstAccountName]);

  useEffect(() => {
    if (!account?.id || !shouldUpgradeBrowserPureP2PAccount(account)) return;
    if (upgradeAccountIdRef.current === account.id) return;

    upgradeAccountIdRef.current = account.id;

    void setAccount({
      ...account,
      pkcOptions: getBrowserPureP2PAccountOptions(account),
    })
      .then(() => {
        window.location.reload();
      })
      .catch((error) => {
        upgradeAccountIdRef.current = undefined;
        console.error('Failed to upgrade browser account to pure P2P options', error);
      });
  }, [account]);
};
