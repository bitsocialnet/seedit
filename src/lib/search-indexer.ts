import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import type { SearchProvider } from './search-providers';
import type { SearchSort, SearchTime } from './utils/search-utils';

export interface IndexedPost {
  archived: 0 | 1;
  author_address: string | null;
  author_name: string | null;
  cid: string;
  community_address: string;
  content: string | null;
  deleted: 0 | 1;
  depth: number;
  downvote_count: number;
  indexed_at: number;
  link?: string | null;
  parent_cid: string | null;
  post_cid: string;
  /** Serialized `{ comment, commentUpdate }` payload, when the provider preserved it. */
  raw?: string | null;
  removed: 0 | 1;
  reply_count: number;
  thumbnail_url?: string | null;
  timestamp: number;
  title: string | null;
  upvote_count: number;
}

export interface IndexerSearchPage {
  limit: number;
  page: number;
  posts: IndexedPost[];
  /** The provider that answered, which is not the first one when a higher-ranked one was down. */
  provider: SearchProvider;
  query: string;
  /** Thread OPs of the matched replies, keyed by post cid. Missing when the provider could not serve them. */
  threadPosts: Record<string, IndexedPost>;
  total: number;
}

/** What the indexer itself can narrow a search by — the advanced-search filters. */
export interface IndexerSearchOptions {
  author?: string;
  community?: string;
  nsfw?: boolean;
  /** Text posts only when true, link posts only when false, both when absent. */
  self?: boolean;
  selftext?: string;
  site?: string;
  /** Relevance when absent. */
  sort?: SearchSort;
  /** All time when absent. */
  time?: SearchTime;
  url?: string;
}

/** The indexer names old.reddit's "comments" sort after what it counts, and ranks by relevance when none is sent. */
const INDEXER_SORTS: Record<SearchSort, string | undefined> = { relevance: undefined, top: 'top', new: 'new', comments: 'replies' };

export const SEARCH_PAGE_SIZE = 25;
const REQUEST_TIMEOUT_MS = 15_000;

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isOptionalNullableString = (value: unknown): value is string | null | undefined => value === undefined || isNullableString(value);
const isFlag = (value: unknown): value is 0 | 1 => value === 0 || value === 1;
const isNonNegativeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isPositiveInteger = (value: unknown): value is number => isNonNegativeInteger(value) && value > 0;

const isIndexedPost = (value: unknown): value is IndexedPost => {
  if (!value || typeof value !== 'object') return false;
  const post = value as Partial<IndexedPost>;
  return (
    isFlag(post.archived) &&
    isNullableString(post.author_address) &&
    isNullableString(post.author_name) &&
    typeof post.cid === 'string' &&
    typeof post.community_address === 'string' &&
    isNullableString(post.content) &&
    isOptionalNullableString(post.link) &&
    isOptionalNullableString(post.raw) &&
    isOptionalNullableString(post.thumbnail_url) &&
    isFlag(post.deleted) &&
    typeof post.post_cid === 'string' &&
    isNonNegativeInteger(post.depth) &&
    isNonNegativeInteger(post.downvote_count) &&
    isNonNegativeInteger(post.upvote_count) &&
    typeof post.indexed_at === 'number' &&
    Number.isFinite(post.indexed_at) &&
    isNullableString(post.parent_cid) &&
    isFlag(post.removed) &&
    isNonNegativeInteger(post.reply_count) &&
    typeof post.timestamp === 'number' &&
    Number.isFinite(post.timestamp) &&
    isNullableString(post.title)
  );
};

type IndexerSearchResponse = Omit<IndexerSearchPage, 'provider' | 'threadPosts'>;

const isSearchResponse = (value: unknown): value is IndexerSearchResponse => {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<IndexerSearchResponse>;
  return (
    typeof result.query === 'string' &&
    isPositiveInteger(result.page) &&
    isPositiveInteger(result.limit) &&
    isNonNegativeInteger(result.total) &&
    Array.isArray(result.posts) &&
    result.posts.every(isIndexedPost)
  );
};

const getApiUrl = (provider: SearchProvider, path: string): URL => {
  const apiBase = provider.apiUrl.endsWith('/') ? provider.apiUrl : `${provider.apiUrl}/`;
  return new URL(path, apiBase);
};

const getSearchUrl = (provider: SearchProvider, query: string, page: number, options: IndexerSearchOptions = {}): string => {
  const url = getApiUrl(provider, 'api/search');
  url.searchParams.set('q', query);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(SEARCH_PAGE_SIZE));
  for (const key of ['author', 'community', 'selftext', 'site', 'url'] as const) {
    const value = options[key]?.trim();
    if (value) url.searchParams.set(key, value);
  }
  // The indexer takes self as yes/no so that absent can mean "either".
  if (options.self !== undefined) url.searchParams.set('self', options.self ? 'yes' : 'no');
  const sort = options.sort && INDEXER_SORTS[options.sort];
  if (sort) url.searchParams.set('sort', sort);
  if (options.time && options.time !== 'all') url.searchParams.set('time', options.time);
  // Always explicit: an indexer that does not know the parameter ignores it, and
  // one that does must not fall back to its own default.
  url.searchParams.set('nsfw', String(options.nsfw === true));
  return url.toString();
};

const fetchProviderJson = async (url: string): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Search provider returned ${response.status}`);
    return await response.json();
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

const fetchIndexedPost = async (provider: SearchProvider, cid: string): Promise<IndexedPost | null> => {
  try {
    const result = await fetchProviderJson(getApiUrl(provider, `api/posts/${encodeURIComponent(cid)}`).toString());
    const post = (result as { post?: unknown } | null)?.post;
    return isIndexedPost(post) ? post : null;
  } catch {
    // A thread OP that cannot be loaded only costs the reply its thread context.
    return null;
  }
};

/**
 * A matched reply is rendered with its thread context, and an archived thread
 * can be gone from the live network, so every distinct thread of the page is
 * fetched from the provider once.
 */
const fetchThreadPosts = async (provider: SearchProvider, posts: IndexedPost[]): Promise<Record<string, IndexedPost>> => {
  const threadCids = [...new Set(posts.filter((post) => post.depth > 0 && post.post_cid !== post.cid).map((post) => post.post_cid))];
  const threadPosts = await Promise.all(threadCids.map((cid) => fetchIndexedPost(provider, cid)));

  return Object.fromEntries(threadPosts.filter((post) => post !== null).map((post) => [post.cid, post]));
};

const fetchSearchPage = async (provider: SearchProvider, query: string, page: number, options?: IndexerSearchOptions): Promise<IndexerSearchPage> => {
  const result: unknown = await fetchProviderJson(getSearchUrl(provider, query, page, options));
  if (!isSearchResponse(result)) throw new Error('Search provider returned an invalid response');
  return { ...result, provider, threadPosts: await fetchThreadPosts(provider, result.posts) };
};

/** Ask each indexer in rank order, so one that is down or broken hands over to the next. */
export const fetchSearchPageFromChain = async (providers: SearchProvider[], query: string, page: number, options?: IndexerSearchOptions): Promise<IndexerSearchPage> => {
  let lastError: unknown = new Error('No search provider is available');

  for (const provider of providers) {
    try {
      return await fetchSearchPage(provider, query, page, options);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

/**
 * A community as the indexer knows it. `post_count` is what the indexer has
 * archived, not the community's real size, so it only ever ranks results.
 */
export interface IndexedCommunity {
  address: string;
  description: string | null;
  last_indexed_at: number | null;
  /** SQLite flag, absent on an indexer too old to track it. */
  nsfw?: 0 | 1;
  post_count: number;
  title: string | null;
}

const isIndexedCommunity = (value: unknown): value is IndexedCommunity => {
  if (!value || typeof value !== 'object') return false;
  const community = value as Partial<IndexedCommunity>;
  return (
    typeof community.address === 'string' &&
    community.address.length > 0 &&
    isNullableString(community.title) &&
    isNullableString(community.description) &&
    isNonNegativeInteger(community.post_count) &&
    (community.nsfw === undefined || isFlag(community.nsfw)) &&
    (community.last_indexed_at === null || typeof community.last_indexed_at === 'number')
  );
};

const fetchCommunities = async (provider: SearchProvider): Promise<IndexedCommunity[]> => {
  const result: unknown = await fetchProviderJson(getApiUrl(provider, 'api/communities').toString());
  const communities = (result as { communities?: unknown } | null)?.communities;
  if (!Array.isArray(communities)) throw new Error('Search provider returned an invalid community list');
  // The list is served whole; drop rows this client cannot read rather than the page.
  return communities.filter(isIndexedCommunity);
};

/**
 * The indexer's own community list, used alongside seedit's lists so a
 * community the client has never heard of can still be found. Unlike a search,
 * an unavailable provider is not an error: seedit's own lists still answer.
 */
export const fetchCommunitiesFromChain = async (providers: SearchProvider[]): Promise<IndexedCommunity[]> => {
  for (const provider of providers) {
    try {
      return await fetchCommunities(provider);
    } catch {
      // Try the next provider; an empty list is a valid, degraded answer.
    }
  }

  return [];
};

type RawCommentPayload = {
  comment?: Record<string, unknown>;
  commentUpdate?: Record<string, unknown>;
};

type IndexedPostAuthor = {
  address?: string;
  displayName?: string;
  shortAddress?: string;
};

const parseRawComment = (raw: string | null | undefined): RawCommentPayload => {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const { comment, commentUpdate } = parsed as RawCommentPayload;
    return {
      comment: comment && typeof comment === 'object' ? comment : undefined,
      commentUpdate: commentUpdate && typeof commentUpdate === 'object' ? commentUpdate : undefined,
    };
  } catch {
    return {};
  }
};

/** Crypto-name addresses are their own short form; public keys shorten the way the hooks store does. */
const getShortAddress = (address: string | undefined): string | undefined => {
  if (!address) return undefined;
  if (address.includes('.')) return address;
  if (address.length < 20) return undefined;
  return address.slice(8, 20);
};

/**
 * Search results are rendered with the regular post and reply components, so an
 * indexed result has to look like a published comment. The provider's `raw`
 * payload already is one (`{ comment, commentUpdate }`), so it is used as the
 * base, while the indexed columns stay authoritative for identity, community
 * and moderation state. The author (signature included) is kept so the regular
 * verification hook and u/<address> links keep working; `pinned` is dropped
 * because pinning is feed-positional and it is the one flag that would let an
 * unverified payload claim a community role badge.
 */
export const getIndexedPostComment = (post: IndexedPost): Comment => {
  const { comment, commentUpdate } = parseRawComment(post.raw);
  const update = { ...commentUpdate };
  // Reply pages are large nested payloads the search view never renders.
  delete update.replies;
  delete update.pinned;
  const updateAuthor = update.author as IndexedPostAuthor | undefined;
  delete update.author;
  const rawAuthor = comment?.author as IndexedPostAuthor | undefined;
  const address = post.author_address ?? rawAuthor?.address;

  return {
    ...comment,
    ...update,
    archived: post.archived === 1,
    author: {
      ...updateAuthor,
      ...rawAuthor,
      address,
      displayName: post.author_name ?? rawAuthor?.displayName,
      shortAddress: rawAuthor?.shortAddress || getShortAddress(address),
    },
    cid: post.cid,
    communityAddress: post.community_address,
    content: post.content ?? undefined,
    deleted: post.deleted === 1,
    depth: post.depth,
    downvoteCount: post.downvote_count,
    link: post.link ?? (comment?.link as string | undefined),
    parentCid: post.parent_cid ?? undefined,
    postCid: post.post_cid,
    removed: post.removed === 1,
    replyCount: post.reply_count,
    state: 'succeeded',
    thumbnailUrl: post.thumbnail_url ?? (comment?.thumbnailUrl as string | undefined),
    timestamp: post.timestamp,
    title: post.title ?? undefined,
    upvoteCount: post.upvote_count,
  } as Comment;
};
