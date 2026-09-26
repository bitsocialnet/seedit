import { describe, expect, it } from 'vitest';
import { getSearchKey, getSearchOptions, getSearchPath } from './search-utils';

describe('search sort and time options', () => {
  it('round-trips old.reddit sort and t params through the results path', () => {
    const path = getSearchPath('test', { nsfw: true, sort: 'top', time: 'week' });

    expect(path).toBe('/search?q=test&nsfw=1&sort=top&t=week');
    expect(getSearchOptions(new URLSearchParams(path.split('?')[1]))).toEqual({ community: undefined, nsfw: true, sort: 'top', time: 'week' });
  });

  it('never writes the defaults and ignores unknown values', () => {
    expect(getSearchPath('test', { sort: 'relevance', time: 'all' })).toBe('/search?q=test');
    expect(getSearchOptions(new URLSearchParams('q=test&sort=hot&t=forever'))).toMatchObject({ sort: undefined, time: undefined });
  });

  it('caches a reordered search separately, and a default choice with the plain search', () => {
    expect(getSearchKey('test', { sort: 'new' })).not.toBe(getSearchKey('test'));
    expect(getSearchKey('test', { time: 'year' })).not.toBe(getSearchKey('test'));
    expect(getSearchKey('test', { sort: 'relevance', time: 'all' })).toBe(getSearchKey('test'));
  });
});
