import { afterEach, describe, expect, it } from 'vitest';
import { getDirectoryCodes, isDirectoryCode, isWellFormedDirectoryCode, setPublishedDirectoryCodes, VENDORED_DIRECTORY_CODES } from './directory-codes';

afterEach(() => {
  setPublishedDirectoryCodes([]);
});

describe('Seedit directory codes', () => {
  it('bundles the reserved lowercase route slugs', () => {
    expect(VENDORED_DIRECTORY_CODES).toEqual(['askseedit', 'memes', 'news', 'pics', 'todayilearned', 'interestingasfuck', 'gaming', 'videos', 'funny', 'aww', 'cats']);
    expect(getDirectoryCodes()).toEqual(VENDORED_DIRECTORY_CODES);
  });

  it('recognizes only exact directory slugs', () => {
    expect(isDirectoryCode('funny')).toBe(true);
    expect(isDirectoryCode('FUNNY')).toBe(false);
    expect(isDirectoryCode('funny.bso')).toBe(false);
    expect(isDirectoryCode('all')).toBe(false);
    expect(isDirectoryCode('mod')).toBe(false);
    expect(isDirectoryCode(undefined)).toBe(false);
  });

  it('rejects codes that could be a community address or a router-owned segment', () => {
    expect(isWellFormedDirectoryCode('dogs')).toBe(true);
    expect(isWellFormedDirectoryCode('dogs.bso')).toBe(false);
    expect(isWellFormedDirectoryCode('Dogs')).toBe(false);
    expect(isWellFormedDirectoryCode('12D3KooWNMybS7FNfdgD8hzRnHbUs1VFqoaC')).toBe(false);
    expect(isWellFormedDirectoryCode('all')).toBe(false);
    expect(isWellFormedDirectoryCode('mod')).toBe(false);
    expect(isWellFormedDirectoryCode('about')).toBe(false);
    // inherited by every plain object keyed by directory code
    expect(isWellFormedDirectoryCode('constructor')).toBe(false);
    expect(isWellFormedDirectoryCode('')).toBe(false);
  });

  it('adds published codes after the bundled ones and never drops a bundled code', () => {
    expect(setPublishedDirectoryCodes(['funny', 'dogs', 'Bad.Code', 'all'])).toBe(true);
    expect(getDirectoryCodes()).toEqual([...VENDORED_DIRECTORY_CODES, 'dogs']);
    expect(isDirectoryCode('dogs')).toBe(true);
    expect(setPublishedDirectoryCodes(['dogs'])).toBe(false);

    setPublishedDirectoryCodes([]);
    expect(isDirectoryCode('dogs')).toBe(false);
    expect(isDirectoryCode('funny')).toBe(true);
  });
});
