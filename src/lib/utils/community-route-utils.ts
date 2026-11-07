import { getDirectoryCodes, isDirectoryCode, isWellFormedDirectoryCode, type KnownDirectoryCodes, type SeeditDirectoryCode } from './directory-codes';

const DEFAULT_COMMUNITY_TLD = '.bso';
const RESERVED_COMMUNITY_ROUTE_SEGMENTS = new Set(['all', 'mod']);
const BASE58_PUBLIC_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{30,}$/;

export const DIRECTORY_INDEX_PATH = '/communities/directories';

const isReservedCommunityRouteSegment = (segment: string): boolean => RESERVED_COMMUNITY_ROUTE_SEGMENTS.has(segment.toLowerCase());

const isLikelyBase58PublicKey = (value: string): boolean => BASE58_PUBLIC_KEY_PATTERN.test(value);

export const isResolvableCommunityAddress = (address: string | undefined): address is string =>
  Boolean(address && (address.includes('.') || isLikelyBase58PublicKey(address)));

/**
 * Expands Seedit's default-TLD route shorthand into the full community address
 * used by data hooks and account state.
 */
export const resolveCommunityRouteAddress = (segment: string | undefined): string | undefined => {
  if (!segment || segment.includes('.') || isReservedCommunityRouteSegment(segment) || isLikelyBase58PublicKey(segment)) {
    return segment;
  }

  return `${segment}${DEFAULT_COMMUNITY_TLD}`;
};

export const getCommunityRouteSegment = (address: string): string => resolveCommunityRouteAddress(address) ?? address;

export const getCommunityPath = (communityAddress: string): string => `/s/${encodeURIComponent(getCommunityRouteSegment(communityAddress))}`;

export const getDirectoryPath = (directoryCode: SeeditDirectoryCode): string => `/s/${encodeURIComponent(directoryCode)}`;

/** The directory's candidate list, where the communities competing for the route are ranked. */
export const getDirectoryCandidatesPath = (directoryCode: SeeditDirectoryCode): string => `${DIRECTORY_INDEX_PATH}/${encodeURIComponent(directoryCode)}`;

/** The mobile sidebar view for the directory index or one directory's candidate list. */
export const getDirectoryAboutPath = (directoryCode?: SeeditDirectoryCode): string =>
  directoryCode ? `${getDirectoryCandidatesPath(directoryCode)}/about` : `${DIRECTORY_INDEX_PATH}/about`;

/** Use for typed or linked references that may intentionally name a directory route. */
export const getCommunityReferencePath = (communityReference: string): string =>
  isDirectoryCode(communityReference) ? getDirectoryPath(communityReference) : getCommunityPath(communityReference);

export const getCommunityPostPath = (communityAddress: string, cid: string): string => `${getCommunityPath(communityAddress)}/comments/${encodeURIComponent(cid)}`;

/** Preserve an explicitly typed directory reference; generated post permalinks use getCommunityPostPath instead. */
export const getCommunityReferencePostPath = (communityReference: string, cid: string): string =>
  `${getCommunityReferencePath(communityReference)}/comments/${encodeURIComponent(cid)}`;

export const getCommunityPostUrl = (communityAddress: string, cid: string): string => `https://s.seedit.app${getCommunityPostPath(communityAddress, cid)}`;

export const getExactCommunityActionRedirectPath = (
  pathname: string,
  directoryCode: SeeditDirectoryCode,
  communityAddress: string,
  search = '',
  hash = '',
): string | undefined => {
  const directoryPath = getDirectoryPath(directoryCode);
  if (!pathname.startsWith(`${directoryPath}/`)) return undefined;
  return `${getCommunityPath(communityAddress)}${pathname.slice(directoryPath.length)}${search}${hash}`;
};

/**
 * Components pass the registry's codes. While a client with no cached copy waits for the published directories, a
 * well-formed code is left alone, so a directory added after this build is not rewritten to `<code>.bso`.
 */
export const getCanonicalCommunityRoutePathname = (
  pathname: string,
  { codes, settled }: KnownDirectoryCodes = { codes: getDirectoryCodes(), settled: true },
): string | undefined => {
  const routeMatch = pathname.match(/^\/s\/([^/?#]+)(.*)$/);
  if (!routeMatch) return undefined;

  let routeSegment: string;
  try {
    routeSegment = decodeURIComponent(routeMatch[1]);
  } catch {
    return undefined;
  }

  if (isDirectoryCode(routeSegment, codes) || (!settled && isWellFormedDirectoryCode(routeSegment))) return undefined;

  const canonicalRouteSegment = getCommunityRouteSegment(routeSegment);
  if (canonicalRouteSegment === routeSegment) return undefined;

  return `/s/${encodeURIComponent(canonicalRouteSegment)}${routeMatch[2]}`;
};

export const getCanonicalCommunityPostRedirectPath = (
  routeCommunitySegment: string | undefined,
  postCommunityAddress: string | undefined,
  cid: string | undefined,
): string | undefined => {
  const routeCommunityAddress = resolveCommunityRouteAddress(routeCommunitySegment);
  const resolvedPostCommunityAddress = resolveCommunityRouteAddress(postCommunityAddress);
  if (!cid || !resolvedPostCommunityAddress) return undefined;
  if (!isDirectoryCode(routeCommunitySegment) && routeCommunityAddress === resolvedPostCommunityAddress) return undefined;
  return getCommunityPostPath(resolvedPostCommunityAddress, cid);
};

export const getCanonicalCommunityPostAboutRedirectPath = (
  routeCommunitySegment: string | undefined,
  postCommunityAddress: string | undefined,
  cid: string | undefined,
): string | undefined => {
  const postRedirectPath = getCanonicalCommunityPostRedirectPath(routeCommunitySegment, postCommunityAddress, cid);
  return postRedirectPath ? `${postRedirectPath}/about` : undefined;
};
