import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { type Community, useCommunity, useCommunityStats } from '@bitsocial/bitsocial-react-hooks';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useIsCommunityOffline from '../../hooks/use-is-community-offline';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import type { SeeditDirectoryCode } from '../../lib/utils/directory-codes';
import { getPlainTextPreview } from '../../lib/utils/plain-text-preview';
import { getFormattedTimeDuration } from '../../lib/utils/time-utils';
import { ModernJoinButton } from '../modern-community-about';
import ModernCommunityAvatar from '../modern-community-avatar';
import { modernStyles } from '../modern-layout';
import styles from './modern-community-row.module.css';

const DESCRIPTION_MAX_LENGTH = 240;

/** Members and age of a loaded community; a separate component so suggestions do not start a stats load. */
const CommunityFacts = ({ community }: { community: Community }) => {
  const { t } = useTranslation();
  const { allActiveUserCount } = useCommunityStats({ community: getCommunityIdentifier(community.address) });
  const { isOffline, isOnlineStatusLoading, offlineTitle } = useIsCommunityOffline(community);
  return (
    <>
      {typeof allActiveUserCount === 'number' && <span>{t('members_count', { count: allActiveUserCount })}</span>}
      {community.createdAt && <span>{t('community_for', { date: getFormattedTimeDuration(community.createdAt) })}</span>}
      {isOffline && !isOnlineStatusLoading && (
        <span className={styles.offline} title={offlineTitle}>
          {t('offline')}
        </span>
      )}
    </>
  );
};

interface ModernCommunityRowProps {
  address: string;
  /** The loaded community; without it the row shows what a list entry knows, such as a default community's title. */
  community?: Community;
  title?: string;
  description?: string;
  nsfw?: boolean;
  tags?: string[];
  /** The account's role in the community, linking to its settings. */
  role?: string;
  directoryCode?: SeeditDirectoryCode;
  directoryRevision?: number;
  /** Facts the list adds about the community, such as its place in a directory. */
  facts?: ReactNode;
}

/** A community in a list: identity, description, facts, and a join button. */
const ModernCommunityRow = ({
  address,
  community,
  title: listTitle,
  description: listDescription,
  nsfw,
  tags,
  role,
  directoryCode,
  directoryRevision,
  facts,
}: ModernCommunityRowProps) => {
  const { t } = useTranslation();
  // Only what is already cached, for the avatar and a title the list entry lacks.
  const cachedCommunity = useCommunity(community ? undefined : { community: getCommunityIdentifier(address), onlyIfCached: true });
  const loaded = community || cachedCommunity;
  const title = loaded?.title || listTitle;
  const description = getPlainTextPreview(loaded?.description || listDescription, DESCRIPTION_MAX_LENGTH);
  const path = getCommunityPath(address);
  const displayAddress = getDisplayAddress(address.includes('.') ? address : loaded?.shortAddress || getShortDisplayAddress(address));

  return (
    <article className={styles.row}>
      <ModernCommunityAvatar address={address} avatarUrl={loaded?.suggested?.avatarUrl} size='medium' />
      <div className={styles.body}>
        <Link to={path} className={styles.identity} title={address}>
          <span className={styles.title}>{title || `s/${displayAddress}`}</span>
          {title && <span className={styles.address}>s/{displayAddress}</span>}
        </Link>
        {description && <p className={styles.description}>{description}</p>}
        <div className={styles.facts}>
          {facts}
          {community && <CommunityFacts community={community} />}
          {nsfw && <span className={`${styles.badge} ${styles.nsfw}`}>{t('nsfw')}</span>}
          {role && (
            <Link to={`${path}/settings`} className={`${styles.badge} ${modernStyles.sentenceCase}`}>
              {t(role)}
            </Link>
          )}
          {tags?.map((tag) => (
            <span key={tag} className={styles.badge}>
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.action}>
        <ModernJoinButton address={address} directoryCode={directoryCode} directoryRevision={directoryRevision} />
      </div>
    </article>
  );
};

export default ModernCommunityRow;
