import { useMemo } from 'react';
import { useAccount } from '@bitsocial/bitsocial-react-hooks';
import { vendoredDirectoryLists } from '../lib/utils/vendored-directory-lists';
import { searchCommunities, type CommunitySearchResult } from '../lib/utils/community-search-utils';
import type { DirectoryListCommunity } from '../lib/utils/directory-list-utils';
import { useArchiveCommunities } from './use-archive-communities';
import { useDefaultSubscriptions } from './use-default-subscriptions';

/** Every vendored directory list, flattened once: the module's lists never change at runtime. */
const vendoredDirectoryCommunities: DirectoryListCommunity[] = Object.values(vendoredDirectoryLists).flatMap((list) => list.communities);

export interface CommunitySearchState {
  communities: CommunitySearchResult[];
  /** The indexer's list is still in flight, so more matches may still appear. */
  loading: boolean;
}

/**
 * The community half of /search. Matches come from seedit's own lists and from
 * the indexer's, merged and deduped, so a community is findable whether seedit
 * ships it, the account subscribes to it, or only the archive has crawled it.
 */
export const useCommunitySearch = (query: string, includeNsfw: boolean): CommunitySearchState => {
  const starter = useDefaultSubscriptions();
  const { communities: archive, loading } = useArchiveCommunities();
  const account = useAccount();
  const subscriptions: string[] = useMemo(() => account?.subscriptions ?? [], [account?.subscriptions]);

  const communities = useMemo(
    () => searchCommunities({ archive, directories: vendoredDirectoryCommunities, starter, subscriptions }, query, { includeNsfw }),
    [archive, starter, subscriptions, query, includeNsfw],
  );

  return { communities, loading };
};
