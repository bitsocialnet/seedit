/**
 * Seedit's reserved short community routes. These slugs are route-only discovery
 * identifiers and must never be persisted in account subscriptions.
 */
export const SEEDIT_DIRECTORY_CODES = ['askseedit', 'memes', 'news', 'pics', 'todayilearned', 'interestingasfuck', 'gaming', 'videos', 'funny', 'aww', 'cats'] as const;

export type SeeditDirectoryCode = (typeof SEEDIT_DIRECTORY_CODES)[number];

const DIRECTORY_CODES_SET: ReadonlySet<string> = new Set(SEEDIT_DIRECTORY_CODES);

export const isDirectoryCode = (value: string | undefined): value is SeeditDirectoryCode => typeof value === 'string' && DIRECTORY_CODES_SET.has(value);
