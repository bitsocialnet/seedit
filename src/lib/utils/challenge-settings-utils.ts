/** The challenge a new challenge slot starts as. */
export const DEFAULT_CHALLENGE_NAME = 'captcha-canvas-v3';

/** The roles and publication types an exclude group can name. */
export const EXCLUDE_ROLES = ['moderator', 'admin', 'owner'] as const;
export const EXCLUDE_PUBLICATION_TYPES = ['post', 'reply', 'vote', 'commentEdit', 'commentModeration', 'communityEdit'] as const;

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
  /** Indexes of other challenges in the list; an author who passed any of them skips this one. */
  challenges?: number[];
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

export const toggleExcludeChallenge = (exclude: ChallengeExclude, challengeIndex: number) => {
  const challenges = exclude.challenges ?? [];
  const nextChallenges = challenges.includes(challengeIndex)
    ? challenges.filter((current) => current !== challengeIndex)
    : [...challenges, challengeIndex].sort((a, b) => a - b);
  return withField(exclude, 'challenges', nextChallenges.length > 0 ? nextChallenges : undefined);
};

/**
 * Removes a challenge from the list. Exclude groups name other challenges by index, so references to the removed one
 * go and later ones shift down, keeping every group pointed at the challenge it meant.
 */
export const removeChallengeAt = (challenges: ChallengeSetting[], removedIndex: number): ChallengeSetting[] =>
  challenges
    .filter((_, index) => index !== removedIndex)
    .map((challenge) =>
      challenge.exclude?.some((group) => group.challenges)
        ? {
            ...challenge,
            exclude: challenge.exclude.map((group) => {
              if (!group.challenges) return group;
              const remaining = group.challenges.filter((index) => index !== removedIndex).map((index) => (index > removedIndex ? index - 1 : index));
              return withField(group, 'challenges', remaining.length > 0 ? remaining : undefined);
            }),
          }
        : challenge,
    );

/** The author addresses a group names, domains first, as one list to edit. */
export const getExcludeAddresses = (exclude: ChallengeExclude | undefined): string[] => [...(exclude?.names ?? []), ...(exclude?.publicKeys ?? [])];

/** The addresses in comma-separated text, trimmed, without empty entries. */
export const parseExcludeAddresses = (text: string) =>
  text
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);

/** Stores comma-separated author addresses, split the way pkc-js tells them apart: a domain contains a dot, a public key does not. */
export const setExcludeAddresses = (exclude: ChallengeExclude, text: string) => {
  const addresses = parseExcludeAddresses(text);
  const names = addresses.filter((address) => address.includes('.'));
  const publicKeys = addresses.filter((address) => !address.includes('.'));
  return withField(withField(exclude, 'names', names.length > 0 ? names : undefined), 'publicKeys', publicKeys.length > 0 ? publicKeys : undefined);
};
