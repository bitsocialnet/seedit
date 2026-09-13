import { isDirectoryCode, type SeeditDirectoryCode } from './directory-codes';
import { isExactCommunitySubscriptionAddress } from './directory-subscriptions';

const STARTER_COMMUNITIES_URL = 'https://raw.githubusercontent.com/bitsocialnet/lists/master/seedit-default-subscriptions.json';
const FETCH_TIMEOUT_MS = 10 * 1000;

export interface DefaultSubscription {
  title?: string;
  description?: string;
  directoryCode?: SeeditDirectoryCode;
  directoryRevision?: number;
  address: string;
  publicKey?: string;
  nsfw?: boolean;
  tags?: string[];
}

export interface StarterCommunityList {
  schemaVersion: 2;
  revision: number;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  communities: DefaultSubscription[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const normalizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const values = [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0))];
  return values.length > 0 ? values : undefined;
};

const normalizeCommunity = (value: unknown): DefaultSubscription | null => {
  if (!isRecord(value) || !isExactCommunitySubscriptionAddress(value.address)) return null;
  const tags = normalizeStringArray(value.tags);
  const directoryCode = typeof value.directoryCode === 'string' && isDirectoryCode(value.directoryCode) ? value.directoryCode : undefined;
  const directoryRevision = Number.isSafeInteger(value.directoryRevision) && (value.directoryRevision as number) >= 1 ? (value.directoryRevision as number) : undefined;

  return {
    address: value.address,
    ...(directoryCode && directoryRevision ? { directoryCode, directoryRevision } : {}),
    ...(typeof value.title === 'string' && value.title ? { title: value.title } : {}),
    ...(typeof value.description === 'string' && value.description ? { description: value.description } : {}),
    ...(typeof value.publicKey === 'string' && value.publicKey ? { publicKey: value.publicKey } : {}),
    ...(typeof value.nsfw === 'boolean' ? { nsfw: value.nsfw } : {}),
    ...(tags ? { tags } : {}),
  };
};

export const normalizeStarterCommunityList = (value: unknown): StarterCommunityList | null => {
  if (!isRecord(value) || value.schemaVersion !== 2 || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1) return null;
  const rawCommunities = Array.isArray(value.communities) ? value.communities : null;
  if (!rawCommunities) return null;

  const communities = rawCommunities.map(normalizeCommunity).filter((community): community is DefaultSubscription => community !== null);
  const uniqueCommunities = communities.filter((community, index) => communities.findIndex(({ address }) => address === community.address) === index);
  if (uniqueCommunities.length === 0) return null;

  return {
    schemaVersion: 2,
    revision: value.revision as number,
    title: typeof value.title === 'string' ? value.title : 'Seedit Default Communities',
    description: typeof value.description === 'string' ? value.description : '',
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
    communities: uniqueCommunities,
  };
};

const hasSameCommunities = (first: StarterCommunityList, second: StarterCommunityList): boolean => {
  return JSON.stringify(first.communities) === JSON.stringify(second.communities);
};

export const normalizeRemoteStarterCommunityList = (value: unknown, currentList: StarterCommunityList): StarterCommunityList | null => {
  const remoteList = normalizeStarterCommunityList(value);
  if (!remoteList) throw new Error('Invalid default communities response');
  if (remoteList.revision < currentList.revision) return null;
  if (remoteList.revision === currentList.revision && !hasSameCommunities(remoteList, currentList)) {
    throw new Error('Default community membership changed without a new revision');
  }
  return remoteList;
};

export const fetchStarterCommunitiesPayload = (timeoutMs = FETCH_TIMEOUT_MS): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(STARTER_COMMUNITIES_URL, { cache: 'no-cache', signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Default communities request failed with ${response.status}`);
      return response.json();
    })
    .finally(() => clearTimeout(timeout));
};
