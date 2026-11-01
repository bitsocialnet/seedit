import { describe, expect, it } from 'vitest';
import { isDirectoryCode, SEEDIT_DIRECTORY_CODES } from './directory-codes';

describe('Seedit directory codes', () => {
  it('contains the reserved lowercase route slugs', () => {
    expect(SEEDIT_DIRECTORY_CODES).toEqual(['askseedit', 'memes', 'news', 'pics', 'todayilearned', 'interestingasfuck', 'gaming', 'videos', 'funny', 'aww', 'cats']);
  });

  it('recognizes only exact directory slugs', () => {
    expect(isDirectoryCode('funny')).toBe(true);
    expect(isDirectoryCode('FUNNY')).toBe(false);
    expect(isDirectoryCode('funny.bso')).toBe(false);
    expect(isDirectoryCode('all')).toBe(false);
    expect(isDirectoryCode('mod')).toBe(false);
    expect(isDirectoryCode(undefined)).toBe(false);
  });
});
