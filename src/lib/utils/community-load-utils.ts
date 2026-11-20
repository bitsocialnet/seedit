import type { Community, CommunityIdentifier, CommunityLoadStatus } from '@bitsocial/bitsocial-react-hooks';

/**
 * The error to show for a useCommunity result. pkc-js keeps retrying a community it cannot reach, so that load never ends
 * in an `error`; while a community without a record is retrying after a failed load (`firstLoadFailed`), its last
 * retriable error says why.
 */
export const getCommunityLoadError = (community?: Community): Error | undefined =>
  community?.error || (community?.firstLoadFailed ? community.lastRetriableError : undefined);

export interface FeedLoadFailure {
  /** `failed` once every community failed for good, `retrying` while some keep retrying after a failure. */
  state: 'failed' | 'retrying';
  /** Why the communities failed, each reason once. */
  errors: Error[];
}

/**
 * How the first load of a feed's communities failed, read from `useCommunities().communityLoadStatuses` at the index of
 * each identifier. A community the account blocked adds no posts, so it doesn't count. The feed has failed only when none
 * of the others has a record and none is still loading without a failure; one that loaded or still loads gives no failure.
 */
export const getFeedLoadFailure = (
  identifiers: CommunityIdentifier[],
  statuses: CommunityLoadStatus[],
  blockedAddresses?: Record<string, unknown>,
): FeedLoadFailure | undefined => {
  const feedStatuses = statuses.filter((_, index) => {
    const address = identifiers[index]?.name ?? identifiers[index]?.publicKey;
    return !(address && blockedAddresses?.[address]);
  });
  if (!feedStatuses.length || feedStatuses.some(({ hasCachedData, firstLoadFailed }) => hasCachedData || !firstLoadFailed)) {
    return undefined;
  }
  const errorsByMessage = new Map<string, Error>();
  for (const { error, lastRetriableError } of feedStatuses) {
    const reason = error || lastRetriableError;
    // a reason without a message would show as a blank line
    if (reason?.message && !errorsByMessage.has(reason.message)) errorsByMessage.set(reason.message, reason);
  }
  return { state: feedStatuses.every(({ state }) => state === 'failed') ? 'failed' : 'retrying', errors: [...errorsByMessage.values()] };
};
