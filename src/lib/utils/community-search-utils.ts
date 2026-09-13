import type { IndexedCommunity } from '../search-indexer';
import type { DefaultSubscription } from './starter-community-list';
import type { DirectoryListCommunity } from './directory-list-utils';
import { getHighlightTerms, matchesQuery } from './search-highlight-utils';

/** A community match, merged from every list that knows the address. */
export interface CommunitySearchResult {
  address: string;
  /** The archive's post count, which ranks results — it is not the community's real size. */
  archivedPostCount?: number;
  description?: string;
  /** The query is this community's exact address, so it is pinned to the top. */
  exact: boolean;
  /** The indexer resolves this from the community's own `features.safeForWork`, its directory, and its content. */
  nsfw: boolean;
  tags?: string[];
  title?: string;
}

/**
 * Seedit's curated lists and the indexer describe the same communities from
 * different angles: the lists carry a curated title, while the indexer knows
 * the crawled title, how much it has archived, and whether the community is
 * nsfw. A merged entry keeps whichever source actually has each field, list
 * first, and is nsfw if any source says so.
 */
interface MergedCommunity extends Omit<CommunitySearchResult, 'exact'> {}

const normalizeAddress = (address: string): string => address.trim().toLowerCase();

const withField = <T>(current: T | undefined, incoming: T | undefined): T | undefined => current ?? incoming;

const mergeInto = (merged: Map<string, MergedCommunity>, entry: MergedCommunity): void => {
  const key = normalizeAddress(entry.address);
  if (!key) return;

  const existing = merged.get(key);
  if (!existing) {
    merged.set(key, entry);
    return;
  }

  merged.set(key, {
    address: existing.address,
    archivedPostCount: withField(existing.archivedPostCount, entry.archivedPostCount),
    description: withField(existing.description, entry.description),
    nsfw: existing.nsfw || entry.nsfw,
    tags: existing.tags && existing.tags.length > 0 ? existing.tags : entry.tags,
    title: withField(existing.title, entry.title),
  });
};

const fromDefaultSubscription = (community: DefaultSubscription): MergedCommunity => ({
  address: community.address,
  description: community.description,
  nsfw: community.nsfw === true,
  tags: community.tags,
  title: community.title,
});

const fromDirectoryCommunity = (community: DirectoryListCommunity): MergedCommunity => ({
  address: community.address,
  nsfw: community.nsfw === true,
  tags: community.tags,
});

const fromIndexedCommunity = (community: IndexedCommunity): MergedCommunity => ({
  address: community.address,
  archivedPostCount: community.post_count,
  description: community.description ?? undefined,
  // Resolved by the indexer from the community's own features, its directory and
  // its content; absent on an indexer too old to track it.
  nsfw: community.nsfw === 1,
  title: community.title ?? undefined,
});

export interface CommunitySearchSources {
  /** The indexer's list, which can hold communities seedit's lists have never carried. */
  archive?: IndexedCommunity[];
  /** Every vendored/remote directory list, flattened. */
  directories?: DirectoryListCommunity[];
  /** The starter/default subscription list, the only source of curated titles. */
  starter?: DefaultSubscription[];
  /** The account's own subscriptions, so a community only this user follows is findable. */
  subscriptions?: string[];
}

/**
 * Every community seedit can name, deduped by address. Seedit's own lists are
 * merged before the indexer's so a curated title and the nsfw flag win.
 */
export const mergeCommunitySources = (sources: CommunitySearchSources): MergedCommunity[] => {
  const merged = new Map<string, MergedCommunity>();

  for (const community of sources.starter ?? []) mergeInto(merged, fromDefaultSubscription(community));
  for (const community of sources.directories ?? []) mergeInto(merged, fromDirectoryCommunity(community));
  for (const address of sources.subscriptions ?? []) mergeInto(merged, { address, nsfw: false });
  for (const community of sources.archive ?? []) mergeInto(merged, fromIndexedCommunity(community));

  return [...merged.values()];
};

/**
 * Rank order, matching what the results page shows first: the exact address,
 * then an address that starts with the query, then a title match, then anything
 * that only matched a description or tag. Ties break on how much the archive
 * holds, then on address so the order is stable.
 */
const getMatchRank = (community: MergedCommunity, query: string, terms: string[]): number => {
  const address = normalizeAddress(community.address);
  if (address === query) return 0;
  if (address.startsWith(query)) return 1;
  if (matchesQuery(community.title, terms)) return 2;
  if (matchesQuery(community.address, terms)) return 3;
  return 4;
};

const isMatch = (community: MergedCommunity, terms: string[]): boolean =>
  matchesQuery(community.address, terms) ||
  matchesQuery(community.title, terms) ||
  matchesQuery(community.description, terms) ||
  (community.tags ?? []).some((tag) => matchesQuery(tag, terms));

export interface CommunitySearchOptions {
  /** Communities marked nsfw are dropped unless this is on. */
  includeNsfw?: boolean;
}

/** The community matches for a query, ranked, with the exact address pinned first. */
export const searchCommunities = (sources: CommunitySearchSources, query: string, options: CommunitySearchOptions = {}): CommunitySearchResult[] => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const normalizedQuery = normalizeAddress(trimmed);
  const terms = getHighlightTerms(trimmed);
  const communities = mergeCommunitySources(sources).filter((community) => (options.includeNsfw || !community.nsfw) && isMatch(community, terms));

  return communities
    .map((community) => ({ community, rank: getMatchRank(community, normalizedQuery, terms) }))
    .sort(
      (a, b) => a.rank - b.rank || (b.community.archivedPostCount ?? 0) - (a.community.archivedPostCount ?? 0) || a.community.address.localeCompare(b.community.address),
    )
    .map(({ community, rank }) => ({ ...community, exact: rank === 0 }));
};
