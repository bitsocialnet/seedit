import type { SearchQueryFilters } from './search-query-utils';

export const SEARCH_PATH = '/search';
export const MAX_SEARCH_QUERY_LENGTH = 200;
/** /search never runs empty: with no query in the URL it searches for seedit itself. */
export const DEFAULT_SEARCH_QUERY = 'seedit';

/** Query-string names, shared by the search bar, the route and the result hooks. */
export const SEARCH_QUERY_PARAM = 'q';
export const SEARCH_NSFW_PARAM = 'nsfw';
export const SEARCH_COMMUNITY_PARAM = 'community';
/** old.reddit's own names for the results page's "sorted by" and "links from" menus. */
export const SEARCH_SORT_PARAM = 'sort';
export const SEARCH_TIME_PARAM = 't';

/** The "sorted by" choices in old.reddit's order and url values; relevance is the default and never written. */
export const SEARCH_SORTS = ['relevance', 'top', 'new', 'comments'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

/** The "links from" choices in old.reddit's order and url values; all is the default and never written. */
export const SEARCH_TIMES = ['hour', 'day', 'week', 'month', 'year', 'all'] as const;
export type SearchTime = (typeof SEARCH_TIMES)[number];

/**
 * Everything that narrows or orders a search: the two the search bar's
 * checkboxes set, the advanced-search prefixes, and the results page's sort and
 * time menus. The indexer honours all of them.
 */
export type SearchOptions = SearchQueryFilters & {
  sort?: SearchSort;
  time?: SearchTime;
};

/** In the order the indexer takes them, so a key is stable across callers. */
export const SEARCH_FILTER_KEYS = ['author', 'community', 'nsfw', 'self', 'selftext', 'site', 'url'] as const;

/**
 * The filters that are a search on their own. `community:` and `nsfw:` only
 * narrow one — asking for a whole community is what the feed is for — so they
 * do not make an otherwise wordless query runnable. This mirrors the indexer,
 * which answers a filter-only search but not a bare `?community=`.
 */
const SEARCHABLE_FILTER_KEYS = ['author', 'self', 'selftext', 'site', 'url'] as const;

/** True when there is anything to ask the indexer for: words, or a filter that stands alone. */
export const hasSearchableInput = (query: string, options: SearchOptions = {}): boolean =>
  Boolean(query.trim()) || SEARCHABLE_FILTER_KEYS.some((key) => options[key] !== undefined && options[key] !== '');

export const getSearchQuery = (raw: string | null): string => (raw ?? '').trim().slice(0, MAX_SEARCH_QUERY_LENGTH);

/** `nsfw=1` is the only truthy form written, but a hand-typed `true` is accepted too. */
export const getSearchNsfw = (raw: string | null): boolean => raw === '1' || raw === 'true';

export const getSearchCommunity = (raw: string | null): string | undefined => (raw ?? '').trim() || undefined;

/** The defaults read as undefined, so a default and an absent choice are the same search. */
export const getSearchSort = (raw: string | null): SearchSort | undefined =>
  raw !== 'relevance' && SEARCH_SORTS.includes(raw as SearchSort) ? (raw as SearchSort) : undefined;

export const getSearchTime = (raw: string | null): SearchTime | undefined =>
  raw !== 'all' && SEARCH_TIMES.includes(raw as SearchTime) ? (raw as SearchTime) : undefined;

export const getSearchOptions = (params: URLSearchParams): SearchOptions => ({
  community: getSearchCommunity(params.get(SEARCH_COMMUNITY_PARAM)),
  nsfw: getSearchNsfw(params.get(SEARCH_NSFW_PARAM)),
  sort: getSearchSort(params.get(SEARCH_SORT_PARAM)),
  time: getSearchTime(params.get(SEARCH_TIME_PARAM)),
});

export const getSearchPath = (query: string, options: SearchOptions = {}): string => {
  const params = new URLSearchParams({ [SEARCH_QUERY_PARAM]: getSearchQuery(query) });
  if (options.community) params.set(SEARCH_COMMUNITY_PARAM, options.community);
  if (options.nsfw) params.set(SEARCH_NSFW_PARAM, '1');
  const sort = getSearchSort(options.sort ?? null);
  if (sort) params.set(SEARCH_SORT_PARAM, sort);
  const time = getSearchTime(options.time ?? null);
  if (time) params.set(SEARCH_TIME_PARAM, time);
  return `${SEARCH_PATH}?${params.toString()}`;
};

/**
 * Results are cached per distinct search, and a narrowed or reordered search is
 * a different search than the same words alone.
 */
export const getSearchKey = (query: string, options: SearchOptions = {}): string =>
  JSON.stringify([
    query,
    ...SEARCH_FILTER_KEYS.map((key) => options[key] ?? null),
    getSearchSort(options.sort ?? null) ?? null,
    getSearchTime(options.time ?? null) ?? null,
  ]);
