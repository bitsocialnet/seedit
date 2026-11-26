import { useCallback } from 'react';
import { type Community, useAccount, useAccountCommunities, useCommunities } from '@bitsocial/bitsocial-react-hooks';
import { deriveCommunityNsfw } from '../lib/utils/nsfw-utils';
import { getCommunityIdentifiers } from './use-community-identifier';
import { useDefaultSubscriptions } from './use-default-subscriptions';
import useDisplayedSubscriptions from './use-displayed-subscriptions';

export type CommunityListView = 'all' | 'subscriber' | 'moderator' | 'admin' | 'owner';

export interface CommunityListItem {
  community: Community;
  nsfw: boolean | undefined;
  tags: string[] | undefined;
  /** The account's role in the community, or owner when the account runs it. */
  role: string | undefined;
}

/**
 * The account's communities for a /communities tab, filtered by a ?tag= from the default list.
 * Subscriptions are a snapshot, so a community the reader just left stays listed until the page reloads.
 */
const useCommunityList = (view: CommunityListView, tag: string | null) => {
  const account = useAccount();
  const accountAddress: string | undefined = account?.author?.address;
  const { accountCommunities, error: accountCommunitiesError } = useAccountCommunities();
  const defaultCommunities = useDefaultSubscriptions();

  const getAddresses = useCallback(() => {
    const subscriptions = account?.subscriptions ? [...account.subscriptions].reverse() : [];
    if (view === 'subscriber') return subscriptions;
    return Array.from(new Set([...Object.keys(accountCommunities), ...subscriptions]));
  }, [account?.subscriptions, accountCommunities, view]);
  // Moderated communities load after the page opens, so their arrival refreshes the snapshot.
  const { list: addresses } = useDisplayedSubscriptions(getAddresses, [accountAddress, view, Object.keys(accountCommunities).length]);

  const isRoleView = view === 'moderator' || view === 'admin' || view === 'owner';
  const { communities, error: communitiesError } = useCommunities({ communities: isRoleView ? [] : getCommunityIdentifiers(addresses) });

  // A loaded community lacks the account's private view of it, so the account's own entry is checked too.
  const getRole = (community: Community): string | undefined => {
    const accountCommunity = (accountCommunities as Record<string, Community | undefined>)[community.address];
    // settings is a private field that only the community's owner has
    if ((accountCommunity as { settings?: unknown } | undefined)?.settings !== undefined || (community as { settings?: unknown }).settings !== undefined) return 'owner';
    return (community.roles ?? accountCommunity?.roles)?.[accountAddress ?? '']?.role;
  };

  const source: Community[] = isRoleView
    ? (Object.values(accountCommunities) as Community[]).filter((community) => {
        const role = getRole(community);
        return role === 'owner' || role === view;
      })
    : (Object.values(communities ?? {}).filter(Boolean) as Community[]);

  const defaultsByAddress = new Map(defaultCommunities.map((community) => [community.address, community]));
  const items: CommunityListItem[] = [];
  for (const community of source) {
    const defaultCommunity = defaultsByAddress.get(community.address);
    const nsfw = deriveCommunityNsfw(community, defaultCommunity);
    if (tag && (tag === 'nsfw' ? nsfw !== true : !defaultCommunity?.tags?.includes(tag))) continue;
    items.push({ community, nsfw, tags: defaultCommunity?.tags, role: getRole(community) });
  }

  return {
    items,
    subscriptionCount: account?.subscriptions?.length ?? 0,
    moderatedCount: Object.keys(accountCommunities).length,
    error: accountCommunitiesError || (isRoleView ? undefined : communitiesError),
  };
};

export default useCommunityList;
