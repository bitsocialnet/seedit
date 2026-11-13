import { useTranslation } from 'react-i18next';
import { useAccount, useSubscribe, type Account } from '@bitsocial/bitsocial-react-hooks';
import { persistStarterAccountUpdate } from '../lib/utils/starter-account-persistence';
import { leaveStarterSubscription, type SeeditStarterSubscriptions } from '../lib/utils/starter-subscriptions';
import { leaveDirectorySubscription, type SeeditDirectoryPreferences } from '../lib/utils/directory-subscriptions';
import { joinDirectoryWinnerAccount } from '../lib/utils/directory-account-transforms';
import type { SeeditDirectoryCode } from '../lib/utils/directory-codes';

interface UseCommunitySubscriptionOptions {
  address: string | undefined;
  directoryCode?: SeeditDirectoryCode;
  directoryRevision?: number;
  onUnsubscribe?: (address: string) => void;
}

/**
 * Join or leave one community. Joining through a directory route records the directory choice, and leaving also
 * clears starter and directory provenance, so the community is not added back later.
 */
const useCommunitySubscription = ({ address, directoryCode, directoryRevision, onUnsubscribe }: UseCommunitySubscriptionOptions) => {
  const { subscribe, subscribed, unsubscribe } = useSubscribe({ communityAddress: address });
  const account = useAccount() as
    | (Account & { seeditDirectoryPreferences?: SeeditDirectoryPreferences; seeditStarterSubscriptions?: SeeditStarterSubscriptions })
    | undefined;
  const { t } = useTranslation();

  const toggleSubscription = async () => {
    try {
      if (subscribed === false) {
        if (address && account && directoryCode && directoryRevision) {
          await persistStarterAccountUpdate(account.id, (currentAccount) => {
            return joinDirectoryWinnerAccount(currentAccount, {
              directoryCode,
              address,
              revision: directoryRevision,
              authoritative: true,
            });
          });
        } else {
          await subscribe();
        }
      } else if (subscribed === true) {
        if (address && account) {
          await persistStarterAccountUpdate(account.id, (currentAccount) => {
            const starterResult = leaveStarterSubscription({
              subscriptions: currentAccount.subscriptions ?? [],
              provenance: currentAccount.seeditStarterSubscriptions,
              address,
            });
            const directoryResult = leaveDirectorySubscription({
              subscriptions: starterResult.subscriptions,
              preferences: currentAccount.seeditDirectoryPreferences,
              address,
            });
            return {
              ...currentAccount,
              subscriptions: directoryResult.subscriptions,
              seeditDirectoryPreferences: directoryResult.preferences,
              ...(starterResult.provenance ? { seeditStarterSubscriptions: starterResult.provenance } : {}),
            };
          });
        } else {
          await unsubscribe();
        }
        if (onUnsubscribe && address) {
          onUnsubscribe(address);
        }
      }
    } catch (error) {
      console.error('Subscription update error:', error);
      alert(error instanceof Error ? error.message : t('failed'));
    }
  };

  return { subscribed, toggleSubscription };
};

export default useCommunitySubscription;
