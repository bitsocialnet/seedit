import { useCallback } from 'react';
import { vendoredDirectoryLists } from '../lib/utils/vendored-directory-lists';
import { getShortDisplayAddress } from '../lib/utils/address-utils';
import { pickDirectoryWinner } from '../lib/utils/directory-list-utils';
import useResolvedCommunityRoute from './use-resolved-community-route';

/**
 * The winner of each vendored directory, keyed by lowercased address. Built once:
 * the vendored lists are static, and this only ever answers "is this address the
 * community a /s/<code> route currently resolves to".
 */
const vendoredWinnersByAddress: ReadonlyMap<string, string> = new Map(
  Object.entries(vendoredDirectoryLists).flatMap(([directoryCode, list]) => {
    const winner = pickDirectoryWinner(list.communities);
    return winner ? [[winner.address.toLowerCase(), directoryCode] as [string, string]] : [];
  }),
);

/**
 * How a community should be named in the UI: `s/<directory code>` when the
 * address is the community that directory route currently resolves to, and the
 * plain `s/<address>` otherwise — including for a community that sits in a
 * directory but is not its winner, whose identity is its address.
 *
 * The active route is the authoritative source, because it has already resolved
 * its directory against the live list; the vendored winners only answer for a
 * community named somewhere other than the route being viewed.
 */
export const useCommunityDisplayName = (): ((address: string | undefined) => string) => {
  const { communityAddress: routeAddress, directoryCode: routeDirectoryCode } = useResolvedCommunityRoute();

  return useCallback(
    (address) => {
      if (!address) return '';
      if (routeDirectoryCode && routeAddress && routeAddress.toLowerCase() === address.toLowerCase()) return `s/${routeDirectoryCode}`;

      const vendoredCode = vendoredWinnersByAddress.get(address.toLowerCase());
      return vendoredCode ? `s/${vendoredCode}` : `s/${getShortDisplayAddress(address)}`;
    },
    [routeAddress, routeDirectoryCode],
  );
};

export default useCommunityDisplayName;
