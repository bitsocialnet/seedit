import { describe, expect, it } from 'vitest';
import type { CommunityLoadStatus } from '@bitsocial/bitsocial-react-hooks';
import { getCommunityLoadError, getFeedLoadFailure } from './community-load-utils';

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

describe('getFeedLoadFailure', () => {
  const status = (fields: Partial<CommunityLoadStatus>) =>
    ({ state: 'fetching-ipns', hasCachedData: false, firstLoadFailed: false, errors: [], ...fields }) as CommunityLoadStatus;
  const failed = (message: string) => status({ state: 'failed', firstLoadFailed: true, error: new Error(message) });
  const retrying = (message: string) => status({ firstLoadFailed: true, lastRetriableError: new Error(message) });
  const ids = (...names: string[]) => names.map((name) => ({ name }));

  it('is failed when every community failed for good, with each reason once', () => {
    expect(getFeedLoadFailure(ids('a.xyz', 'b.xyz'), [failed('No name resolver'), failed('No name resolver')])).toEqual({
      state: 'failed',
      errors: [new Error('No name resolver')],
    });
  });

  it('is retrying when no community loaded or still loads and some keep retrying after a failure', () => {
    const failure = getFeedLoadFailure(ids('a.xyz', 'b.bso'), [failed('No name resolver'), retrying('Domain resolver did not find the text record')]);
    expect(failure?.state).toBe('retrying');
    expect(failure?.errors.map(({ message }) => message)).toEqual(['No name resolver', 'Domain resolver did not find the text record']);
  });

  it('is undefined while a community loaded or is still loading without a failure, or without communities', () => {
    expect(getFeedLoadFailure(ids('a.xyz', 'b.bso'), [failed('No name resolver'), status({ state: 'succeeded', hasCachedData: true })])).toBeUndefined();
    expect(getFeedLoadFailure(ids('a.xyz', 'b.bso'), [failed('No name resolver'), status({})])).toBeUndefined();
    expect(getFeedLoadFailure([], [])).toBeUndefined();
  });

  it('leaves out the communities the account blocked, by name or public key', () => {
    const loaded = status({ state: 'succeeded', hasCachedData: true });
    expect(getFeedLoadFailure([{ name: 'blocked.bso' }, { name: 'a.xyz' }], [loaded, failed('No name resolver')], { 'blocked.bso': true })?.state).toBe('failed');
    expect(getFeedLoadFailure([{ publicKey: '12D3KooWBlocked' }, { name: 'a.xyz' }], [loaded, failed('No name resolver')], { '12D3KooWBlocked': true })?.state).toBe(
      'failed',
    );
    expect(getFeedLoadFailure([{ name: 'blocked.bso' }], [failed('No name resolver')], { 'blocked.bso': true })).toBeUndefined();
  });
});
