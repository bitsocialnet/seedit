import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAccount } from '@bitsocial/bitsocial-react-hooks';
import { useFilteredDefaultSubscriptions } from '../../hooks/use-default-subscriptions';
import useCommunityList, { type CommunityListView } from '../../hooks/use-community-list';
import { DIRECTORY_INDEX_PATH } from '../../lib/utils/community-route-utils';
import ErrorDisplay from '../../components/error-display';
import ModernCommunityRow from '../../components/modern-community-row';
import { PlusIcon } from '../../components/modern-icons';
import { ModernColumns, ModernRailSection, modernStyles } from '../../components/modern-layout';
import { ModernUserTabs } from '../../components/modern-user-profile';
import styles from './modern-communities.module.css';

const VIEWS: CommunityListView[] = ['all', 'subscriber', 'moderator', 'admin', 'owner'];

const getView = (pathname: string): CommunityListView => {
  const segment = pathname.split('/')[2];
  return VIEWS.includes(segment as CommunityListView) ? (segment as CommunityListView) : 'all';
};

/** Default communities the account has not joined yet, as a way to find more. */
const SuggestedCommunities = () => {
  const { t } = useTranslation();
  const subscriptions: string[] | undefined = useAccount()?.subscriptions;
  const defaults = useFilteredDefaultSubscriptions();
  const suggestions = useMemo(() => {
    const subscribed = new Set(subscriptions ?? []);
    return defaults.filter((community) => !subscribed.has(community.address));
  }, [defaults, subscriptions]);

  if (suggestions.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby='modern-suggested-communities'>
      <div className={styles.sectionHeader}>
        <h2 id='modern-suggested-communities' className={`${styles.sectionTitle} ${modernStyles.sentenceCase}`}>
          {t('starter_communities')}
        </h2>
        <Link to='/communities/defaults' className={styles.textLink}>
          <span className={modernStyles.sentenceCase}>{t('show')}</span>
        </Link>
      </div>
      {suggestions.map((community) => (
        <ModernCommunityRow
          key={community.address}
          address={community.address}
          title={community.title}
          description={community.description}
          nsfw={community.nsfw}
          tags={community.tags}
          directoryCode={community.directoryCode}
          directoryRevision={community.directoryRevision}
        />
      ))}
    </section>
  );
};

/** The account's communities by role, with default communities to join below. */
const ModernCommunities = () => {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const view = getView(pathname);
  const tag = new URLSearchParams(search).get('tag');
  const { items, subscriptionCount, moderatedCount, error } = useCommunityList(view, tag);

  useEffect(() => {
    document.title = `${t('communities').charAt(0).toUpperCase()}${t('communities').slice(1)} - Seedit`;
  }, [t]);

  const tabs = VIEWS.map((name) => ({ path: name === 'all' ? '/communities' : `/communities/${name}`, label: t(name), isActive: name === view }));

  let emptyText: string | undefined;
  if (items.length === 0) {
    if (view === 'subscriber') emptyText = t('not_subscribed');
    else if (view !== 'all') emptyText = moderatedCount > 0 ? t('nothing_found') : t('not_moderator');
    else emptyText = subscriptionCount === 0 && moderatedCount === 0 ? t('not_subscriber_nor_moderator') : t('nothing_found');
  }

  return (
    <ModernColumns
      rail={
        <ModernRailSection title={<span className={modernStyles.sentenceCase}>{t('create_your_community')}</span>}>
          <Link to='/communities/create' className={`${modernStyles.primaryButton} ${styles.railButton}`}>
            <PlusIcon size={18} />
            <span className={modernStyles.sentenceCase}>{t('create_community')}</span>
          </Link>
          <Link to={DIRECTORY_INDEX_PATH} className={`${modernStyles.secondaryButton} ${styles.railButton}`}>
            <span className={modernStyles.sentenceCase}>{t('directories')}</span>
          </Link>
        </ModernRailSection>
      }
    >
      <header className={styles.header}>
        <h1 className={`${styles.heading} ${modernStyles.sentenceCase}`}>{t('communities')}</h1>
        {/* The rail holds the same links from 1200px. */}
        <div className={styles.headerActions}>
          <Link to='/communities/create' className={modernStyles.secondaryButton}>
            <PlusIcon size={18} />
            <span className={modernStyles.sentenceCase}>{t('create_community')}</span>
          </Link>
          <Link to={DIRECTORY_INDEX_PATH} className={modernStyles.secondaryButton}>
            <span className={modernStyles.sentenceCase}>{t('directories')}</span>
          </Link>
        </div>
      </header>
      <ModernUserTabs tabs={tabs} label={t('communities')} />
      {tag && (
        <p className={styles.notice}>
          {tag === 'nsfw' ? t('filtering_by_nsfw') : t('filtering_by_tag', { tag })}{' '}
          <Link to={pathname} className={styles.textLink}>
            {t('undo')}
          </Link>
        </p>
      )}
      {error && items.length === 0 && (
        <div className={styles.error}>
          <ErrorDisplay error={error} />
        </div>
      )}
      {emptyText ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        items.map(({ community, nsfw, tags, role }) => (
          <ModernCommunityRow key={community.address} address={community.address} community={community} nsfw={nsfw} tags={tags} role={role} />
        ))
      )}
      {(view === 'all' || view === 'subscriber') && !tag && <SuggestedCommunities />}
    </ModernColumns>
  );
};

export default ModernCommunities;
