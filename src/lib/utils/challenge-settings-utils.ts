/** The challenge a new challenge slot starts as. */
export const DEFAULT_CHALLENGE_NAME = 'captcha-canvas-v3';

/** The roles and publication types an exclude group can name; pkc-js accepts more, which the editors leave as they are. */
export const EXCLUDE_ROLES = ['moderator', 'admin', 'owner'] as const;
export const EXCLUDE_PUBLICATION_TYPES = ['post', 'reply', 'vote'] as const;

export type ExcludeRole = (typeof EXCLUDE_ROLES)[number];
export type ExcludePublicationType = (typeof EXCLUDE_PUBLICATION_TYPES)[number];
export type ExcludeNumberField = 'postScore' | 'replyScore' | 'firstCommentTimestamp' | 'rateLimit';

/**
 * A group of authors a challenge skips, as pkc-js stores it in community.settings.challenges[x].exclude. An author matching
 * every field in a group is excluded. Since pkc-js v42 the fields are `roles`, `publicKeys` and `names` (the old `role` and
 * `address` are refused on save), and publication types live under `publicationType`, whose values are only ever true.
 */
export interface ChallengeExclude {
  postScore?: number;
  replyScore?: number;
  firstCommentTimestamp?: number;
  roles?: string[];
  publicKeys?: string[];
  names?: string[];
  publicationType?: { [type: string]: boolean | undefined };
  rateLimit?: number;
  rateLimitChallengeSuccess?: boolean;
  [field: string]: unknown;
}

/** A challenge in community.settings.challenges, or a community's published challenge when the settings are not readable. */
export interface ChallengeSetting {
  name?: string;
  options?: Record<string, string>;
  exclude?: ChallengeExclude[];
  type?: string;
  description?: string;
  [field: string]: unknown;
}

/** Sets a field, or removes it when the value is undefined, since pkc-js refuses empty lists and objects. */
const withField = <Key extends keyof ChallengeExclude>(exclude: ChallengeExclude, key: Key, value: ChallengeExclude[Key] | undefined): ChallengeExclude => {
  const { [key]: _removed, ...rest } = exclude;
  return value === undefined ? rest : { ...rest, [key]: value };
};

export const setExcludeNumber = (exclude: ChallengeExclude, key: ExcludeNumberField, value: number | undefined) => withField(exclude, key, value);

export const setExcludeRateLimitChallengeSuccess = (exclude: ChallengeExclude, value: boolean | undefined) => withField(exclude, 'rateLimitChallengeSuccess', value);

export const toggleExcludeRole = (exclude: ChallengeExclude, role: ExcludeRole) => {
  const roles = exclude.roles ?? [];
  const nextRoles = roles.includes(role) ? roles.filter((current) => current !== role) : [...roles, role];
  return withField(exclude, 'roles', nextRoles.length > 0 ? nextRoles : undefined);
};

export const toggleExcludePublicationType = (exclude: ChallengeExclude, type: ExcludePublicationType) => {
  const { [type]: isSet, ...otherTypes } = exclude.publicationType ?? {};
  const nextTypes = isSet ? otherTypes : { ...otherTypes, [type]: true };
  return withField(exclude, 'publicationType', Object.keys(nextTypes).length > 0 ? nextTypes : undefined);
};

/** The author addresses a group names, domains first, as one list to edit. */
export const getExcludeAddresses = (exclude: ChallengeExclude | undefined): string[] => [...(exclude?.names ?? []), ...(exclude?.publicKeys ?? [])];

/** Stores comma-separated author addresses, split the way pkc-js tells them apart: a domain contains a dot, a public key does not. */
export const setExcludeAddresses = (exclude: ChallengeExclude, text: string) => {
  const addresses = text
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
  const names = addresses.filter((address) => address.includes('.'));
  const publicKeys = addresses.filter((address) => !address.includes('.'));
  return withField(withField(exclude, 'names', names.length > 0 ? names : undefined), 'publicKeys', publicKeys.length > 0 ? publicKeys : undefined);
};
