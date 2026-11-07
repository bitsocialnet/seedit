import { useEffect } from 'react';
import { useAccount } from '@bitsocial/bitsocial-react-hooks';
import type { SeeditDirectoryCode } from '../../lib/utils/directory-codes';
import type { AuthoritativeDirectoryWinnerSnapshot } from '../../lib/utils/directory-subscriptions';
import { pickDirectoryWinner } from '../../lib/utils/directory-list-utils';
import { persistStarterAccountUpdate } from '../../lib/utils/starter-account-persistence';
import type { StarterAccount } from '../../lib/utils/starter-account';
import { reconcileDirectoryWinnerAccount } from '../../lib/utils/directory-account-transforms';
import { useDirectoryList } from '../../hooks/use-directory-list';
import { useDirectoryRegistry } from '../../hooks/use-directory-registry';
import useContentOptionsStore from '../../stores/use-content-options-store';

const DirectorySlotReconciler = ({ directoryCode }: { directoryCode: SeeditDirectoryCode }) => {
  const account = useAccount() as StarterAccount | undefined;
  const { list } = useDirectoryList(directoryCode);
  const hideNsfwCommunities = useContentOptionsStore((state) => state.hideNsfwCommunities);
  const winner = list ? pickDirectoryWinner(list.communities) : undefined;
  const winnerIsHidden = Boolean(hideNsfwCommunities && winner?.nsfw);

  useEffect(() => {
    if (!account || !list || !winner || winnerIsHidden) return;

    const winnerSnapshot: AuthoritativeDirectoryWinnerSnapshot = {
      directoryCode,
      address: winner.address,
      revision: list.revision,
      authoritative: true,
    };

    void persistStarterAccountUpdate(account.id, (currentAccount) => reconcileDirectoryWinnerAccount(currentAccount, winnerSnapshot)).catch((error) =>
      console.error(`Directory ${directoryCode} subscription reconciliation error:`, error),
    );
  }, [account, directoryCode, list, winner, winnerIsHidden]);

  return null;
};

const DirectorySubscriptionReconciler = () => {
  const account = useAccount() as StarterAccount | undefined;
  const { codes } = useDirectoryRegistry();
  const trackedCodes = codes.filter((directoryCode) => account?.seeditDirectoryPreferences?.slots?.[directoryCode]);

  return trackedCodes.map((directoryCode) => <DirectorySlotReconciler key={directoryCode} directoryCode={directoryCode} />);
};

export default DirectorySubscriptionReconciler;
