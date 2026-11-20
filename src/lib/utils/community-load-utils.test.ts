import { describe, expect, it } from 'vitest';
import { getCommunityLoadError } from './community-load-utils';

describe('getCommunityLoadError', () => {
  const error = new Error('No name resolver can handle this address');
  const retriableError = new Error('Domain resolver did not find the text record');

  it('returns the error of a community whose load failed', () => {
    expect(getCommunityLoadError({ state: 'failed', firstLoadFailed: true, error })).toBe(error);
  });

  it('returns the last retriable error while a community without a record keeps retrying', () => {
    expect(getCommunityLoadError({ state: 'fetching-ipns', firstLoadFailed: true, lastRetriableError: retriableError })).toBe(retriableError);
  });

  it('ignores the retriable error of a community that has a record or has not failed', () => {
    expect(getCommunityLoadError({ state: 'succeeded', updatedAt: 1, firstLoadFailed: false, lastRetriableError: retriableError })).toBeUndefined();
    expect(getCommunityLoadError(undefined)).toBeUndefined();
  });
});
