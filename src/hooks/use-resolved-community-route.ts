import { useParams } from 'react-router-dom';
import { getDirectoryCodes, isDirectoryCode, isWellFormedDirectoryCode, type KnownDirectoryCodes, type SeeditDirectoryCode } from '../lib/utils/directory-codes';
import { pickDirectoryWinner, type DirectoryList, type DirectoryListCommunity } from '../lib/utils/directory-list-utils';
import { resolveCommunityRouteAddress } from '../lib/utils/community-route-utils';
import { useDirectoryList } from './use-directory-list';
import { useDirectoryRegistry } from './use-directory-registry';

export interface ResolvedCommunityRoute {
  routeIdentifier: string | undefined;
  communityAddress: string | undefined;
  directoryCode: SeeditDirectoryCode | undefined;
  directoryList: DirectoryList | null;
  winner: DirectoryListCommunity | undefined;
  isDirectory: boolean;
  isResolving: boolean;
  error: Error | null;
}

export const resolveCommunityRouteSnapshot = (
  routeIdentifier: string | undefined,
  directoryList: DirectoryList | null,
  loading: boolean,
  error: Error | null,
  { codes, settled }: KnownDirectoryCodes = { codes: getDirectoryCodes(), settled: true },
): ResolvedCommunityRoute => {
  const directoryCode = isDirectoryCode(routeIdentifier, codes) ? routeIdentifier : undefined;
  // Until the published directories load, a well-formed code may still name a directory added after this build.
  const awaitingDirectoryCodes = !directoryCode && !settled && isWellFormedDirectoryCode(routeIdentifier);
  const winner = directoryCode && directoryList ? pickDirectoryWinner(directoryList.communities) : undefined;

  return {
    routeIdentifier,
    communityAddress: directoryCode ? winner?.address : awaitingDirectoryCodes ? undefined : resolveCommunityRouteAddress(routeIdentifier),
    directoryCode,
    directoryList: directoryCode ? directoryList : null,
    winner,
    isDirectory: Boolean(directoryCode),
    isResolving: Boolean((directoryCode && loading && !winner) || awaitingDirectoryCodes),
    error: directoryCode ? error : null,
  };
};

/** Resolve only the current route. Account subscriptions and home feeds must not use this hook. */
const useResolvedCommunityRoute = (routeIdentifierOverride?: string): ResolvedCommunityRoute => {
  const params = useParams<{ communityAddress?: string }>();
  const routeIdentifier = routeIdentifierOverride ?? params.communityAddress;
  // Re-resolve when directories published after this build become known.
  const { codes, settled } = useDirectoryRegistry();
  const directoryCode = isDirectoryCode(routeIdentifier, codes) ? routeIdentifier : undefined;
  const { list, loading, error } = useDirectoryList(directoryCode);

  return resolveCommunityRouteSnapshot(routeIdentifier, list, loading, error, { codes, settled });
};

export default useResolvedCommunityRoute;
