import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadMoreArchiveSearch, retryArchiveSearch, useArchiveSearch } from '../../hooks/use-archive-search';
import { useCommunitySearch } from '../../hooks/use-community-search';
import { DEFAULT_SEARCH_QUERY, getSearchOptions, getSearchPath, getSearchQuery } from '../../lib/utils/search-utils';
import { parseSearchQuery } from '../../lib/utils/search-query-utils';
import { getHighlightTerms } from '../../lib/utils/search-highlight-utils';
import useCommunityDisplayName from '../../hooks/use-community-display-name';
import { SearchResultCommunity, SearchResultGroup, SearchResultPost } from '../../components/search-result';
import Sidebar from '../../components/sidebar';
import layoutStyles from '../../components/feed-layout';
import styles from './search.module.css';

/** How many community matches a group shows before "load more" reveals the next batch. */
const COMMUNITY_PAGE_SIZE = 5;

const Search = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  // The box's raw text stays in `q`, the way old.reddit keeps it, so a search
  // with advanced-search prefixes is shareable and survives a reload.
  const rawQuery = getSearchQuery(searchParams.get('q'));
  const { filters, freeText: searchText } = useMemo(() => parseSearchQuery(rawQuery), [rawQuery]);
  const checkboxOptions = useMemo(() => getSearchOptions(searchParams), [searchParams]);

  // A typed prefix is deliberate, so it beats the equivalent checkbox.
  const restrictedCommunity = filters.community ?? checkboxOptions.community;
  const nsfw = filters.nsfw ?? checkboxOptions.nsfw ?? false;
  const options = useMemo(() => ({ ...filters, community: restrictedCommunity, nsfw }), [filters, restrictedCommunity, nsfw]);

  // Only the words are searched for and highlighted; the prefixes are not terms.
  const terms = useMemo(() => getHighlightTerms(searchText), [searchText]);
  const getCommunityDisplayName = useCommunityDisplayName();

  // Community matches are seedit's own; a search already pinned to one community does not repeat it.
  const { communities } = useCommunitySearch(restrictedCommunity ? '' : searchText, nsfw);
  const [visibleCommunities, setVisibleCommunities] = useState(COMMUNITY_PAGE_SIZE);
  const [communityPageKey, setCommunityPageKey] = useState('');
  const currentCommunityPageKey = `${searchText}|${nsfw}|${restrictedCommunity ?? ''}`;
  // Reset the reveal count when the search changes, without waiting for an effect.
  if (communityPageKey !== currentCommunityPageKey) {
    setCommunityPageKey(currentCommunityPageKey);
    setVisibleCommunities(COMMUNITY_PAGE_SIZE);
  }

  // The indexer applies the nsfw choice server-side, so its total matches what is shown.
  const { comments: posts, error, hasMore, loading, loadingMore, provider, total } = useArchiveSearch(searchText, options);

  const documentTitle = `${t('search_results')}: ${rawQuery} - Seedit`;
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  // /search never runs empty: with no query in the URL it searches for seedit itself
  if (!rawQuery) {
    return <Navigate to={getSearchPath(DEFAULT_SEARCH_QUERY, checkboxOptions)} replace />;
  }

  const shownCommunities = communities.slice(0, visibleCommunities);

  return (
    <div>
      <div className={layoutStyles.content}>
        <div className={layoutStyles.sidebar}>
          <Sidebar />
        </div>
        <div className={styles.listing}>
          {/* An unlabelled group, the way the results page shows community matches; hidden when nothing matched. */}
          {!restrictedCommunity && shownCommunities.length > 0 && (
            <SearchResultGroup
              hasMore={communities.length > shownCommunities.length}
              isEmpty={false}
              onLoadMore={() => setVisibleCommunities((current) => current + COMMUNITY_PAGE_SIZE)}
            >
              {shownCommunities.map((community) => (
                <SearchResultCommunity community={community} key={community.address} nsfw={nsfw} query={searchText} terms={terms} />
              ))}
            </SearchResultGroup>
          )}

          <SearchResultGroup
            hasMore={hasMore}
            heading={
              restrictedCommunity
                ? t('search_results_in', { community: getCommunityDisplayName(restrictedCommunity), interpolation: { escapeValue: false } })
                : t('posts')
            }
            isEmpty={!loading && !error && posts.length === 0}
            loadingMore={loadingMore}
            onLoadMore={() => loadMoreArchiveSearch(searchText, options)}
          >
            {loading && <p className={styles.info}>{t('searching')}</p>}
            {error && (
              <p className={styles.error}>
                {t('search_provider_unavailable')}
                <button className={styles.retry} onClick={() => retryArchiveSearch(searchText, options)} type='button'>
                  {t('retry')}
                </button>
              </p>
            )}
            {posts.map((comment) => (
              <SearchResultPost comment={comment} key={comment.cid} terms={terms} />
            ))}
          </SearchResultGroup>

          {provider && total > 0 && (
            <p className={styles.info}>
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
