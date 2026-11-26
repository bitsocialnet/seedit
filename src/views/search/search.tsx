import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SEARCH_QUERY, getSearchPath } from '../../lib/utils/search-utils';
import useSearchPage from '../../hooks/use-search-page';
import useCommunityDisplayName from '../../hooks/use-community-display-name';
import SearchBar from '../../components/search-bar';
import { SearchResultCommunity, SearchResultGroup, SearchResultMenus, SearchResultPost } from '../../components/search-result';
import Sidebar from '../../components/sidebar';
import layoutStyles from '../../components/feed-layout';
import styles from './search.module.css';

const Search = () => {
  const { t } = useTranslation();
  const {
    rawQuery,
    searchText,
    checkboxOptions,
    restrictedCommunity,
    nsfw,
    terms,
    shownCommunities,
    hasMoreCommunities,
    showMoreCommunities,
    comments: posts,
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
  if (!rawQuery) {
    return <Navigate to={getSearchPath(DEFAULT_SEARCH_QUERY, checkboxOptions)} replace />;
  }

  return (
    <div>
      <div className={layoutStyles.content}>
        <div className={layoutStyles.sidebar}>
          <Sidebar />
        </div>
        <div className={styles.listing}>
          <SearchBar variant='page' />
          {/* An unlabelled group, the way the results page shows community matches; hidden when nothing matched. */}
          {!restrictedCommunity && shownCommunities.length > 0 && (
            <SearchResultGroup hasMore={hasMoreCommunities} isEmpty={false} onLoadMore={showMoreCommunities}>
              {shownCommunities.map((community) => (
                <SearchResultCommunity community={community} key={community.address} nsfw={nsfw} query={searchText} terms={terms} />
              ))}
            </SearchResultGroup>
          )}

          <SearchResultGroup
            hasMore={hasMore}
            headingMenus={<SearchResultMenus options={checkboxOptions} query={rawQuery} />}
            heading={
              restrictedCommunity
                ? t('search_results_in', { community: getCommunityDisplayName(restrictedCommunity), interpolation: { escapeValue: false } })
                : t('posts')
            }
            isEmpty={!loading && !error && posts.length === 0}
            loadingMore={loadingMore}
            onLoadMore={loadMorePosts}
          >
            {loading && <p className={styles.info}>{t('searching')}</p>}
            {error && (
              <p className={styles.error}>
                {t('search_provider_unavailable')}
                <button className={styles.retry} onClick={retry} type='button'>
                  {t('retry')}
                </button>
              </p>
            )}
            {posts.map((comment) => (
              <SearchResultPost comment={comment} key={comment.cid} terms={terms} />
            ))}
          </SearchResultGroup>

          {provider && total > 0 && (
            <p className={`${styles.info} ${styles.providedBy}`}>
              {t('results_provided_by')}{' '}
              <a href={provider.siteUrl} rel='noopener noreferrer' target='_blank'>
                {provider.name}
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Search;
