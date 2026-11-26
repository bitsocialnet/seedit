import { useParams, useSearchParams } from 'react-router-dom';
import { useCommunities, type Community } from '@bitsocial/bitsocial-react-hooks';
import { isDirectoryCode, isWellFormedDirectoryCode, type SeeditDirectoryCode } from '../lib/utils/directory-codes';
import { pickDirectoryWinner, sortDirectoryCommunitiesByRank, type DirectoryListCommunity } from '../lib/utils/directory-list-utils';
import { communityMatchesSearch, directoryMatchesSearch, getDirectoryMetadata, getDirectorySearchTags } from '../lib/utils/directory-search-utils';
import { getCommunityIdentifiers } from './use-community-identifier';
import { useDirectoryList } from './use-directory-list';
import { useDirectoryRegistry } from './use-directory-registry';

// Directories are the reserved /s/ routes communities compete for; both interfaces' directory pages use these hooks.

/** The ?q search text of a directory page, replaced in place so typing does not stack history entries. */
export const useDirectorySearchQuery = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const setQuery = (nextQuery: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextQuery) nextSearchParams.set('q', nextQuery);
    else nextSearchParams.delete('q');
    setSearchParams(nextSearchParams, { replace: true });
  };
  return { query, setQuery };
};

/** The route's directory code, the directory it names once known, and whether it names none. */
export const useDirectoryRoute = () => {
  const { directoryCode } = useParams();
  const { codes, settled } = useDirectoryRegistry();
  const isKnownDirectory = isDirectoryCode(directoryCode, codes);
  // A code may belong to a directory published after this build; wait for the published codes before calling it unknown.
  const isUnknownDirectory = Boolean(directoryCode) && !isKnownDirectory && (settled || !isWellFormedDirectoryCode(directoryCode));
  return { directoryCode, knownDirectoryCode: isKnownDirectory ? (directoryCode as SeeditDirectoryCode) : undefined, isUnknownDirectory };
};

/** Every directory, and whether any matches the search text. */
export const useDirectoryIndex = (query: string) => {
  const { codes, defaults } = useDirectoryRegistry();
  const hasMatch = codes.some((directoryCode) =>
    directoryMatchesSearch(query, directoryCode, getDirectoryMetadata(directoryCode, defaults), getDirectorySearchTags(directoryCode, defaults)),
  );
  return { codes, hasMatch };
};

/** One directory's title, description, tags, current list and winner, and whether it matches the search text. */
export const useDirectoryEntry = (directoryCode: SeeditDirectoryCode, query = '') => {
  const { list, error } = useDirectoryList(directoryCode);
  const { defaults } = useDirectoryRegistry();
  const metadata = getDirectoryMetadata(directoryCode, defaults);
  const tags = getDirectorySearchTags(directoryCode, defaults);
  return {
    list,
    error,
    title: metadata.title,
    description: metadata.description,
    tags,
    winner: list ? pickDirectoryWinner(list.communities) : undefined,
    matchesSearch: directoryMatchesSearch(query, directoryCode, metadata, tags),
  };
};

export interface DirectoryCandidate {
  candidate: DirectoryListCommunity;
  community: Community;
  /** Position in the ranking, counting candidates the search hides. */
  rankIndex: number;
}

/** A directory's candidates in rank order, loaded as communities, with those matching the search text. */
export const useDirectoryCandidates = (directoryCode: SeeditDirectoryCode, query: string) => {
  const entry = useDirectoryEntry(directoryCode);
  const ranked = entry.list ? sortDirectoryCommunitiesByRank(entry.list.communities) : [];
  const { communities } = useCommunities({ communities: getCommunityIdentifiers(ranked.map(({ address }) => address)) });
  // Index by address rather than by request position: a candidate that has not loaded yet must keep
  // its rank instead of dropping out of the competition, and must never inherit a neighbour's data.
  const loadedCommunities = new Map(
    Object.values(communities ?? {})
      .filter((community): community is Community => Boolean(community?.address))
      .map((community) => [community.address, community]),
  );
  const visibleCandidates = ranked.reduce<DirectoryCandidate[]>((matches, candidate, rankIndex) => {
    const community = loadedCommunities.get(candidate.address) ?? ({ address: candidate.address } as Community);
    if (communityMatchesSearch(query, candidate, community)) matches.push({ candidate, community, rankIndex });
    return matches;
  }, []);
  return { ...entry, ranked, visibleCandidates };
};
