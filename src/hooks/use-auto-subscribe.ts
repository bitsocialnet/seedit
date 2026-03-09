import { useEffect } from 'react';
import { useAccount, setAccount } from '@bitsocialnet/bitsocial-react-hooks';
import { getAutoSubscribeAddresses, useDefaultSubplebbits } from './use-default-subplebbits';
import { useAutoSubscribeStore } from '../stores/use-auto-subscribe-store';

const AUTO_SUBSCRIBE_KEY_PREFIX = 'seedit-auto-subscribe-done-';

// Keep track of which accounts have been processed globally
const processedAccounts = new Set<string>();

export const useAutoSubscribe = () => {
  const account = useAccount();
  const accountAddress = account?.author?.address;
  const defaultSubplebbits = useDefaultSubplebbits();
  const { addCheckingAccount, removeCheckingAccount, isCheckingAccount } = useAutoSubscribeStore();

  useEffect(() => {
    if (!accountAddress) return;

    // Mark as checking immediately when account changes
    addCheckingAccount(accountAddress);

    const processAutoSubscribe = async () => {
      if (!account || !defaultSubplebbits?.length) return;

      if (processedAccounts.has(accountAddress)) {
        removeCheckingAccount(accountAddress);
        return;
      }

      const storageKey = AUTO_SUBSCRIBE_KEY_PREFIX + accountAddress;
      const hasAutoSubscribed = localStorage.getItem(storageKey);

      if (account.subscriptions?.length > 0 || hasAutoSubscribed) {
        processedAccounts.add(accountAddress);
        removeCheckingAccount(accountAddress);
        return;
      }

      const autoSubscribeAddresses = getAutoSubscribeAddresses();
      if (autoSubscribeAddresses.length) {
        try {
          await setAccount({
            ...account,
            subscriptions: autoSubscribeAddresses,
          });
          localStorage.setItem(storageKey, 'true');
        } catch (error) {
          console.error('Auto-subscribe error:', error);
        }
      }

      processedAccounts.add(accountAddress);
      removeCheckingAccount(accountAddress);
    };

    processAutoSubscribe();

    return () => {
      if (accountAddress) removeCheckingAccount(accountAddress);
    };
  }, [account, accountAddress, defaultSubplebbits, addCheckingAccount, removeCheckingAccount]);

  return {
    isCheckingSubscriptions: !accountAddress || isCheckingAccount(accountAddress),
  };
};
