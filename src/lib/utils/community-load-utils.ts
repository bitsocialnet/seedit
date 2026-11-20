import type { Community } from '@bitsocial/bitsocial-react-hooks';

/**
 * The error to show for a useCommunity result. pkc-js keeps retrying a community it cannot reach, so that load never ends
 * in an `error`; while a community without a record is retrying after a failed load (`firstLoadFailed`), its last
 * retriable error says why.
 */
export const getCommunityLoadError = (community?: Community): Error | undefined =>
  community?.error || (community?.firstLoadFailed ? community.lastRetriableError : undefined);
