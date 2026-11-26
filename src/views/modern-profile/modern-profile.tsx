import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAccount, useAccountComments, useAccountVotes } from '@bitsocial/bitsocial-react-hooks';
import useAuthorProfile from '../../hooks/use-author-profile';
import { getAccountHistoryOrder, isAccountPost, isAccountReply } from '../../lib/utils/account-history-utils';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import ErrorDisplay from '../../components/error-display';
import { ModernColumns, modernStyles } from '../../components/modern-layout';
import { ModernCidList, ModernModeratorOf, ModernUserFeed, ModernUserHeader, ModernUserTabs } from '../../components/modern-user-profile';
import styles from './modern-profile.module.css';

const PAGE_SIZE = 10;
const SORT_TYPES = ['new', 'old'] as const;
type SortType = (typeof SORT_TYPES)[number];

const PROFILE_TABS = ['overview', 'submitted', 'comments', 'upvoted', 'downvoted', 'hidden', 'saved'] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

const getProfileTab = (pathname: string): ProfileTab => {
  const segment = pathname.split('/')[2];
  return (PROFILE_TABS as readonly string[]).includes(segment) ? (segment as ProfileTab) : 'overview';
};

const SortSelect = ({ sortType, onChange }: { sortType: SortType; onChange: (sortType: SortType) => void }) => {
  const { t } = useTranslation();
  return (
    <label className={styles.sort}>
      <span className={modernStyles.sentenceCase}>{t('sorted_by')}</span>
      <select value={sortType} onChange={(event) => onChange(event.target.value as SortType)}>
        {SORT_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(type)}
          </option>
        ))}
      </select>
    </label>
  );
};

/** The account's own posts and replies, including ones still publishing. */
const AccountCommentsList = ({ tab, sortType }: { tab: 'overview' | 'submitted' | 'comments'; sortType: SortType }) => {
  const { t } = useTranslation();
  const filter = tab === 'submitted' ? isAccountPost : tab === 'comments' ? isAccountReply : undefined;
  const { error, accountComments } = useAccountComments({ filter, order: getAccountHistoryOrder(sortType) });
  return (
    <>
      {error?.message && accountComments.length === 0 && (
        <div className={styles.error}>
          <ErrorDisplay error={error} />
        </div>
      )}
      <ModernUserFeed comments={accountComments} hasMore={false} loadingText={t('loading')} stateKey={`profile|${tab}|${sortType}`} />
    </>
  );
};

const VotedList = ({ vote, sortType }: { vote: 1 | -1; sortType: SortType }) => {
  const [count, setCount] = useState(PAGE_SIZE);
  const order = getAccountHistoryOrder(sortType);
  const { accountVotes } = useAccountVotes({ vote, order, page: 0, pageSize: count });
  // One vote past the shown ones says whether there are more.
  const { accountVotes: nextVotes } = useAccountVotes({ vote, order, page: count, pageSize: 1 });
  const cids = useMemo(() => accountVotes.map((accountVote) => accountVote.commentCid).filter((cid): cid is string => Boolean(cid)), [accountVotes]);
  return <ModernCidList cids={cids} hasMore={nextVotes.length > 0} onLoadMore={() => setCount(count + PAGE_SIZE)} />;
};

const HiddenList = () => {
  const blockedCids = useAccount()?.blockedCids;
  const [count, setCount] = useState(PAGE_SIZE);
  const allCids = useMemo(() => Object.keys(blockedCids ?? {}), [blockedCids]);
  return <ModernCidList cids={allCids.slice(0, count)} hasMore={allCids.length > count} onLoadMore={() => setCount(count + PAGE_SIZE)} />;
};

const SavedList = ({ savedCids }: { savedCids: string[] }) => {
  // Kept as the page opened, so unsaving a comment here does not pull it out from under the reader.
  const [initialCids] = useState(() => [...savedCids]);
  const [count, setCount] = useState(PAGE_SIZE);
  return <ModernCidList cids={initialCids.slice(0, count)} hasMore={initialCids.length > count} onLoadMore={() => setCount(count + PAGE_SIZE)} />;
};

/** The account's own profile, with its posts, replies, votes, and saved and hidden comments. */
const ModernProfile = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const account = useAccount();
  const profile = useAuthorProfile();
  const tab = getProfileTab(pathname);
  const [sortType, setSortType] = useState<SortType>('new');

  const userAddress = `u/${getDisplayAddress(profile.shortAddress || '')}`;
  const profileTitle = profile.displayName ? `${profile.displayName} (${userAddress})` : userAddress;
  useEffect(() => {
    document.title = `${profileTitle} - Seedit`;
  }, [profileTitle]);

  const tabs = PROFILE_TABS.map((name) => ({
    path: name === 'overview' ? '/profile' : `/profile/${name}`,
    label: name === 'submitted' ? t('posts') : t(name),
    isActive: name === tab,
  }));
  const isSortable = tab !== 'hidden' && tab !== 'saved';

  let list: React.ReactNode;
  if (tab === 'upvoted' || tab === 'downvoted') list = <VotedList key={`${tab}|${sortType}`} vote={tab === 'upvoted' ? 1 : -1} sortType={sortType} />;
  else if (tab === 'hidden') list = <HiddenList />;
  else if (tab === 'saved') list = account ? <SavedList savedCids={account.savedComments ?? []} /> : null;
  else list = <AccountCommentsList tab={tab} sortType={sortType} />;

  return (
    <ModernColumns rail={profile.moderatedCommunities.length > 0 && <ModernModeratorOf communityAddresses={profile.moderatedCommunities} />}>
      <ModernUserHeader
        address={profile.address}
        shortAddress={profile.shortAddress}
        displayName={profile.displayName}
        postKarma={profile.postKarma}
        commentKarma={profile.commentKarma}
        oldestCommentTimestamp={profile.oldestCommentTimestamp}
        actions={
          <Link to='/settings#displayName' className={modernStyles.secondaryButton} aria-label={`${t('edit')} ${t('display_name')}`}>
            <span className={modernStyles.sentenceCase}>{t('edit')}</span>
          </Link>
        }
      />
      <ModernUserTabs tabs={tabs} label={profileTitle}>
        {isSortable && <SortSelect sortType={sortType} onChange={setSortType} />}
      </ModernUserTabs>
      {list}
    </ModernColumns>
  );
};

export default ModernProfile;
