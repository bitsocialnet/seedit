import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import useCommunityDisplayName from '../../hooks/use-community-display-name';
import useSearchPage from '../../hooks/use-search-page';
import { DEFAULT_SEARCH_QUERY, getSearchPath, SEARCH_SORTS, SEARCH_TIMES, type SearchSort, type SearchTime } from '../../lib/utils/search-utils';
import ModernCommunityRow from '../../components/modern-community-row';
import { CloseIcon } from '../../components/modern-icons';
import { ModernColumns, modernStyles } from '../../components/modern-layout';
import { ModernUserFeedStatus } from '../../components/modern-user-profile';
import ModernPostCard from '../../components/modern-post-card';
import ModernReplyCard from '../../components/modern-reply-card';
import styles from './modern-search.module.css';

const TIME_LABEL_KEYS: Record<SearchTime, string> = {
  hour: 'past_hour',
  day: 'past_24_hours',
  week: 'past_week',
  month: 'past_month',
  year: 'past_year',
  all: 'all_time',
};

/** Search results: matching communities, then matching posts and replies from the archive indexer. */
const ModernSearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    rawQuery,
    checkboxOptions,
    restrictedCommunity,
    nsfw,
    shownCommunities,
    hasMoreCommunities,
    showMoreCommunities,
    comments,
    error,
    hasMore,
    loading,
    loadingMore,
    provider,
    total,
    loadMorePosts,
    retry,
  } = useSearchPage();
  const getCommunityDisplayName = useCommunityDisplayName();

  const documentTitle = `${t('search_results')}: ${rawQuery} - Seedit`;
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  // /search never runs empty: with no query in the URL it searches for seedit itself
  if (!rawQuery) return <Navigate to={getSearchPath(DEFAULT_SEARCH_QUERY, checkboxOptions)} replace />;

  // Each choice is a url, so a search is shareable and survives a reload.
  const searchWith = (changes: Partial<typeof checkboxOptions>) => navigate(getSearchPath(rawQuery, { ...checkboxOptions, ...changes }));
  const sort = checkboxOptions.sort ?? 'relevance';
  const time = checkboxOptions.time ?? 'all';

  return (
    <ModernColumns>
      <header className={styles.header}>
        <h1 className={styles.heading}>
          <span className={modernStyles.sentenceCase}>{t('search_results')}</span>
          <span className={styles.query}>“{rawQuery}”</span>
        </h1>
        {restrictedCommunity && (
          <p className={styles.scope}>
            <span className={modernStyles.sentenceCase}>
              {t('search_results_in', { community: getCommunityDisplayName(restrictedCommunity), interpolation: { escapeValue: false } })}
            </span>
            <button type='button' className={styles.iconButton} aria-label={t('remove')} onClick={() => searchWith({ community: undefined })}>
              <CloseIcon size={16} />
            </button>
          </p>
        )}
        <div className={styles.filters}>
          <label className={styles.select}>
            <span className={modernStyles.sentenceCase}>{t('sorted_by')}</span>
            <select value={sort} onChange={(event) => searchWith({ sort: event.target.value as SearchSort })}>
              {SEARCH_SORTS.map((choice) => (
                <option key={choice} value={choice}>
                  {t(choice)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.select}>
            <span className={modernStyles.sentenceCase}>{t('links_from')}</span>
            <select value={time} onChange={(event) => searchWith({ time: event.target.value as SearchTime })}>
              {SEARCH_TIMES.map((choice) => (
                <option key={choice} value={choice}>
                  {t(TIME_LABEL_KEYS[choice])}
                </option>
              ))}
            </select>
          </label>
          <button type='button' className={`${styles.toggle} ${nsfw ? styles.toggleOn : ''}`} aria-pressed={nsfw} onClick={() => searchWith({ nsfw: !nsfw })}>
            {t('include_nsfw_results')}
          </button>
        </div>
      </header>

      {shownCommunities.length > 0 && (
        <section className={styles.section} aria-labelledby='modern-search-communities'>
          <h2 id='modern-search-communities' className={`${styles.sectionTitle} ${modernStyles.sentenceCase}`}>
            {t('communities')}
          </h2>
          {shownCommunities.map((community) => (
            <ModernCommunityRow
              key={community.address}
              address={community.address}
              title={community.title}
              description={community.description}
              nsfw={community.nsfw}
              tags={community.tags}
            />
          ))}
          {hasMoreCommunities && (
            <div className={styles.more}>
              <button type='button' className={modernStyles.secondaryButton} onClick={showMoreCommunities}>
                {t('load_more')}
              </button>
            </div>
          )}
        </section>
      )}

      <section className={styles.section} aria-labelledby='modern-search-posts'>
        <h2 id='modern-search-posts' className={`${styles.sectionTitle} ${modernStyles.sentenceCase}`}>
          {t('posts')}
        </h2>
        {loading && <ModernUserFeedStatus text={`${t('searching')}…`} isLoading />}
        {error && (
          <div className={styles.error} role='alert'>
            <span className={modernStyles.sentenceCase}>{t('search_provider_unavailable')}</span>
            <button type='button' className={modernStyles.secondaryButton} onClick={retry}>
              <span className={modernStyles.sentenceCase}>{t('retry')}</span>
            </button>
          </div>
        )}
        {!loading && !error && comments.length === 0 && <ModernUserFeedStatus text={t('nothing_found')} />}
        {comments.map((comment) => (comment.parentCid ? <ModernReplyCard key={comment.cid} reply={comment} /> : <ModernPostCard key={comment.cid} post={comment} />))}
        {hasMore && (
          <div className={styles.more}>
            {loadingMore ? (
              <ModernUserFeedStatus text={`${t('searching')}…`} isLoading />
            ) : (
              <button type='button' className={modernStyles.secondaryButton} onClick={loadMorePosts}>
                {t('load_more')}
              </button>
            )}
          </div>
        )}
      </section>

      {provider && total > 0 && (
        <p className={styles.provider}>
          <span className={modernStyles.sentenceCase}>{t('results_provided_by')}</span>{' '}
          <a href={provider.siteUrl} rel='noopener noreferrer' target='_blank'>
            {provider.name}
          </a>
        </p>
      )}
    </ModernColumns>
  );
};

export default ModernSearch;
