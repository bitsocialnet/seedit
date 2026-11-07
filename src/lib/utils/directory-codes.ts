/**
 * Seedit's reserved short community routes. These slugs are route-only discovery
 * identifiers and must never be persisted in account subscriptions.
 *
 * This build bundles a snapshot of them; bitsocialnet/lists can publish more at runtime
 * (see directory-registry.ts), so older releases still learn about new directories.
 */
export const VENDORED_DIRECTORY_CODES = ['askseedit', 'memes', 'news', 'pics', 'todayilearned', 'interestingasfuck', 'gaming', 'videos', 'funny', 'aww', 'cats'] as const;

export type VendoredDirectoryCode = (typeof VENDORED_DIRECTORY_CODES)[number];

/** Any bundled or published directory code. Use isDirectoryCode to check one is known right now. */
export type SeeditDirectoryCode = string;

// Short enough to never look like a base58 public key, and never a dotted community name.
const DIRECTORY_CODE_PATTERN = /^[a-z0-9]{1,24}$/;
// Segments the router already owns under /s/ and /communities/directories/.
const ROUTER_OWNED_SEGMENTS: ReadonlySet<string> = new Set(['all', 'mod', 'about']);
const VENDORED_DIRECTORY_CODES_SET: ReadonlySet<string> = new Set(VENDORED_DIRECTORY_CODES);

// The code checks return plain booleans rather than type guards: every code is a string, so a guard
// would narrow a rejected string to never.

/** Whether a value could name a directory, independent of which directories this client knows yet. */
export const isWellFormedDirectoryCode = (value: unknown): boolean =>
  typeof value === 'string' && DIRECTORY_CODE_PATTERN.test(value) && !ROUTER_OWNED_SEGMENTS.has(value);

export const isVendoredDirectoryCode = (value: unknown): value is VendoredDirectoryCode => typeof value === 'string' && VENDORED_DIRECTORY_CODES_SET.has(value);

let directoryCodes: readonly SeeditDirectoryCode[] = VENDORED_DIRECTORY_CODES;
let directoryCodesSet: ReadonlySet<string> = VENDORED_DIRECTORY_CODES_SET;

/** Bundled codes first, then codes published after this build, in published order. */
export const getDirectoryCodes = (): readonly SeeditDirectoryCode[] => directoryCodes;

/** What a component knows about directory codes: `codes` and `settled` from useDirectoryRegistry(). */
export interface KnownDirectoryCodes {
  codes: readonly SeeditDirectoryCode[];
  /** False only while a client with no cached copy waits for the first published codes. */
  settled: boolean;
}

/**
 * Whether a value is a directory code this client knows. Components and hooks must pass `codes` from
 * useDirectoryRegistry(): the React Compiler memoizes a call on its arguments, so a check that only read the
 * module's current codes would keep its first answer after published codes arrive.
 */
export const isDirectoryCode = (value: string | undefined, codes: readonly SeeditDirectoryCode[] = directoryCodes): boolean =>
  typeof value === 'string' && (codes === directoryCodes ? directoryCodesSet.has(value) : codes.includes(value));

/**
 * Replace the published codes. Bundled codes always stay, because this build ships their lists.
 * Returns whether the known set changed.
 */
export const setPublishedDirectoryCodes = (publishedCodes: readonly string[]): boolean => {
  const nextCodes = [...new Set([...VENDORED_DIRECTORY_CODES, ...publishedCodes.filter((code) => isWellFormedDirectoryCode(code))])];
  if (nextCodes.length === directoryCodes.length && nextCodes.every((code, index) => code === directoryCodes[index])) return false;

  directoryCodes = nextCodes;
  directoryCodesSet = new Set(nextCodes);
  return true;
};
