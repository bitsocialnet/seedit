import { useParams } from 'react-router-dom';
import { isDirectoryCode, type SeeditDirectoryCode } from '../lib/utils/directory-codes';
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
): ResolvedCommunityRoute => {
  const directoryCode = isDirectoryCode(routeIdentifier) ? routeIdentifier : undefined;
  const winner = directoryCode && directoryList ? pickDirectoryWinner(directoryList.communities) : undefined;

  return {
    routeIdentifier,
    communityAddress: directoryCode ? winner?.address : resolveCommunityRouteAddress(routeIdentifier),
    directoryCode,
    directoryList: directoryCode ? directoryList : null,
    winner,
    isDirectory: Boolean(directoryCode),
    isResolving: Boolean(directoryCode && loading && !winner),
    error: directoryCode ? error : null,
  };
};

/** Resolve only the current route. Account subscriptions and home feeds must not use this hook. */
const useResolvedCommunityRoute = (routeIdentifierOverride?: string): ResolvedCommunityRoute => {
  const params = useParams<{ communityAddress?: string }>();
  const routeIdentifier = routeIdentifierOverride ?? params.communityAddress;
  // Re-resolve when directories published after this build become known.
  useDirectoryRegistry();
  const directoryCode = isDirectoryCode(routeIdentifier) ? routeIdentifier : undefined;
  const { list, loading, error } = useDirectoryList(directoryCode);

  return resolveCommunityRouteSnapshot(routeIdentifier, list, loading, error);
};

export default useResolvedCommunityRoute;
