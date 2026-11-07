import { Link } from 'react-router-dom';
import { useAccount } from '@bitsocial/bitsocial-react-hooks';
import { useTranslation } from 'react-i18next';
import type { SeeditDirectoryCode } from '../../lib/utils/directory-codes';
import { observeDirectoryWinnerChanges, type AuthoritativeDirectoryWinnerSnapshot } from '../../lib/utils/directory-subscriptions';
import { pickDirectoryWinner } from '../../lib/utils/directory-list-utils';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { persistStarterAccountUpdate } from '../../lib/utils/starter-account-persistence';
import type { StarterAccount } from '../../lib/utils/starter-account';
import {
  applyManualDirectoryWinnerAccount,
  resolveAutomaticDirectoryNoticeAccount,
  type ManualDirectoryWinnerAction,
} from '../../lib/utils/directory-account-transforms';
import { useDirectoryList } from '../../hooks/use-directory-list';
import { useDirectoryRegistry } from '../../hooks/use-directory-registry';
import useContentOptionsStore from '../../stores/use-content-options-store';
import styles from './directory-subscription-updates-notice.module.css';

const persistManualAction = (accountId: string, winner: AuthoritativeDirectoryWinnerSnapshot, action: ManualDirectoryWinnerAction) =>
  persistStarterAccountUpdate(accountId, (currentAccount) => applyManualDirectoryWinnerAccount(currentAccount, winner, action));

const ManualDirectoryChangeNotice = ({ directoryCode }: { directoryCode: SeeditDirectoryCode }) => {
  const { t } = useTranslation();
  const account = useAccount() as StarterAccount | undefined;
  const { list } = useDirectoryList(directoryCode);
  const hideNsfwCommunities = useContentOptionsStore((state) => state.hideNsfwCommunities);
  const winner = list ? pickDirectoryWinner(list.communities) : undefined;

  if (!account || !list || !winner || (hideNsfwCommunities && winner.nsfw)) return null;

  const winnerSnapshot: AuthoritativeDirectoryWinnerSnapshot = {
    directoryCode,
    address: winner.address,
    revision: list.revision,
    authoritative: true,
  };
  const pending = observeDirectoryWinnerChanges({
    subscriptions: account.subscriptions ?? [],
    preferences: account.seeditDirectoryPreferences,
    winners: [winnerSnapshot],
  }).pendingChanges[0];

  if (!pending) return null;

  const runAction = (action: ManualDirectoryWinnerAction) => {
    void persistManualAction(account.id, winnerSnapshot, action).catch((error) => console.error(`Directory ${directoryCode} update error:`, error));
  };

  return (
    <section className={styles.notice} aria-live='polite'>
      <strong>{t('directory_recommendation_changed', { directoryCode })}</strong>{' '}
      <Link to={getCommunityPath(pending.winnerAddress)}>{getDisplayAddress(pending.winnerAddress)}</Link>. {t('directory_you_still_follow')}{' '}
      <Link to={getCommunityPath(pending.currentAddress)}>{getDisplayAddress(pending.currentAddress)}</Link>.
      <span className={styles.actions}>
        <button type='button' onClick={() => runAction('switch')}>
          {t('switch_to_community', { communityAddress: getDisplayAddress(pending.winnerAddress) })}
        </button>
        <button type='button' onClick={() => runAction('keepBoth')}>
          {t('keep_both_communities')}
        </button>
        <button type='button' onClick={() => runAction('keep')}>
          {t('keep_community', { communityAddress: getDisplayAddress(pending.currentAddress) })}
        </button>
      </span>
    </section>
  );
};

const AutomaticDirectoryChangeNotice = ({ directoryCode }: { directoryCode: SeeditDirectoryCode }) => {
  const { t } = useTranslation();
  const account = useAccount() as StarterAccount | undefined;
  const notice = account?.seeditDirectoryPreferences?.automaticChangeNotices?.[directoryCode];

  if (!account || !notice) return null;

  const runAction = (action: 'dismiss' | 'undo') => {
    void persistStarterAccountUpdate(account.id, (currentAccount) => {
      return resolveAutomaticDirectoryNoticeAccount(currentAccount, directoryCode, action);
    }).catch((error) => console.error(`Directory ${directoryCode} automatic switch notice error:`, error));
  };

  return (
    <section className={styles.notice} aria-live='polite'>
      <strong>{t('directory_automatic_switch_notice', { directoryCode, fromAddress: notice.fromAddress, toAddress: notice.toAddress })}</strong>
      <span className={styles.actions}>
        <button type='button' onClick={() => runAction('undo')}>
          {t('undo')}
        </button>
        <button type='button' onClick={() => runAction('dismiss')}>
          {t('dismiss')}
        </button>
      </span>
    </section>
  );
};

const DirectorySubscriptionUpdatesNotice = () => {
  const account = useAccount() as StarterAccount | undefined;
  const { codes } = useDirectoryRegistry();
  const activeCodes = codes.filter(
    (directoryCode) => account?.seeditDirectoryPreferences?.slots?.[directoryCode] || account?.seeditDirectoryPreferences?.automaticChangeNotices?.[directoryCode],
  );

  return activeCodes.flatMap((directoryCode) => [
    <AutomaticDirectoryChangeNotice key={`${directoryCode}-automatic`} directoryCode={directoryCode} />,
    <ManualDirectoryChangeNotice key={`${directoryCode}-manual`} directoryCode={directoryCode} />,
  ]);
};

export default DirectorySubscriptionUpdatesNotice;
