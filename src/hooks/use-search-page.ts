import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getHighlightTerms } from '../lib/utils/search-highlight-utils';
import { parseSearchQuery } from '../lib/utils/search-query-utils';
import { getSearchOptions, getSearchQuery } from '../lib/utils/search-utils';
import { loadMoreArchiveSearch, retryArchiveSearch, useArchiveSearch } from './use-archive-search';
import { useCommunitySearch } from './use-community-search';

/** How many community matches show before "load more" reveals the next batch. */
const COMMUNITY_PAGE_SIZE = 5;

/** The /search route's query, options, and results; both interfaces' search pages read it. */
const useSearchPage = () => {
  const [searchParams] = useSearchParams();
  // The box's raw text stays in `q`, the way old.reddit keeps it, so a search
  // with advanced-search prefixes is shareable and survives a reload.
  const rawQuery = getSearchQuery(searchParams.get('q'));
  const { filters, freeText: searchText } = useMemo(() => parseSearchQuery(rawQuery), [rawQuery]);
  const checkboxOptions = useMemo(() => getSearchOptions(searchParams), [searchParams]);

  // A typed prefix is deliberate, so it beats the equivalent checkbox.
  const restrictedCommunity = filters.community ?? checkboxOptions.community;
  const nsfw = filters.nsfw ?? checkboxOptions.nsfw ?? false;
  const { sort, time } = checkboxOptions;
  const options = useMemo(() => ({ ...filters, community: restrictedCommunity, nsfw, sort, time }), [filters, restrictedCommunity, nsfw, sort, time]);

  // Only the words are searched for and highlighted; the prefixes are not terms.
  const terms = useMemo(() => getHighlightTerms(searchText), [searchText]);

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
  const shownCommunities = restrictedCommunity ? [] : communities.slice(0, visibleCommunities);

  // The indexer applies the nsfw choice server-side, so its total matches what is shown.
  const archive = useArchiveSearch(searchText, options);

  return {
    rawQuery,
    /** The words of the query, without its advanced-search prefixes. */
    searchText,
    checkboxOptions,
    restrictedCommunity,
    nsfw,
    terms,
    shownCommunities,
    hasMoreCommunities: !restrictedCommunity && communities.length > shownCommunities.length,
    showMoreCommunities: () => setVisibleCommunities((current) => current + COMMUNITY_PAGE_SIZE),
    ...archive,
    loadMorePosts: () => loadMoreArchiveSearch(searchText, options),
    retry: () => retryArchiveSearch(searchText, options),
  };
};

export default useSearchPage;
