import type { Community } from '@bitsocial/bitsocial-react-hooks';
import type { SeeditDirectoryCode } from './directory-codes';
import type { DirectoryDefaultsData, DirectoryDefaultsEntry, DirectoryListCommunity } from './directory-list-utils';
import { getVendoredDirectoryList } from './vendored-directory-lists';

export const getDirectoryMetadata = (directoryCode: SeeditDirectoryCode, defaults: DirectoryDefaultsData): DirectoryDefaultsEntry =>
  defaults.directories[directoryCode] ?? {};

/** Bundled list tags for bundled directories; published metadata tags for directories added after this build. */
export const getDirectorySearchTags = (directoryCode: SeeditDirectoryCode, defaults: DirectoryDefaultsData): string[] | undefined =>
  getVendoredDirectoryList(directoryCode)?.tags ?? defaults.directories[directoryCode]?.tags;

const matchesQuery = (query: string, values: (string | undefined)[]) => {
  const normalizedQuery = query.trim().toLowerCase();
  return !normalizedQuery || values.some((value) => value?.toLowerCase().includes(normalizedQuery));
};

/** Whether a directory's code, title, description or tags contain the search text. */
export const directoryMatchesSearch = (
  query: string,
  directoryCode: SeeditDirectoryCode,
  metadata: { title?: string; description?: string },
  tags: string[] | undefined,
): boolean => matchesQuery(query, [directoryCode, metadata.title, metadata.description, ...(tags ?? [])]);

/** Whether a directory candidate's address, owner, tags, or loaded title and description contain the search text. */
export const communityMatchesSearch = (query: string, candidate: DirectoryListCommunity, community: Community): boolean =>
  matchesQuery(query, [candidate.address, candidate.owner, ...(candidate.tags ?? []), community.shortAddress, community.title, community.description]);
