import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchStarterCommunitiesPayload, normalizeRemoteStarterCommunityList, normalizeStarterCommunityList } from './starter-community-list';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('fetchStarterCommunitiesPayload', () => {
  it('keeps the timeout active while a response body stalls', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) =>
      Promise.resolve({
        ok: true,
        json: () =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          }),
      } as Response),
    );

    const payload = fetchStarterCommunitiesPayload(100);
    const rejection = expect(payload).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
  });
});

describe('normalizeStarterCommunityList', () => {
  it('accepts a versioned starter list and deduplicates addresses', () => {
    expect(
      normalizeStarterCommunityList({
        schemaVersion: 2,
        revision: 2,
        title: 'Starter communities',
        communities: [
          { directoryCode: 'aww', directoryRevision: 1, address: 'aww.bso', title: 'Aww', tags: ['cute', 'cute'] },
          { address: 'aww.bso', title: 'Duplicate' },
          { directoryCode: 'unknown', address: 'unknown.bso' },
          { address: 'funny' },
          { address: 'news.bso', nsfw: false },
        ],
      }),
    ).toMatchObject({
      schemaVersion: 2,
      revision: 2,
      communities: [
        { directoryCode: 'aww', directoryRevision: 1, address: 'aww.bso', title: 'Aww', tags: ['cute'] },
        { address: 'unknown.bso' },
        { address: 'news.bso', nsfw: false },
      ],
    });
  });

  it('rejects unversioned, empty, and malformed remote payloads', () => {
    expect(normalizeStarterCommunityList({ schemaVersion: 2, revision: 1 })).toBeNull();
    expect(normalizeStarterCommunityList({ schemaVersion: 2, revision: 1, communities: [] })).toBeNull();
    expect(normalizeStarterCommunityList({ schemaVersion: 2, revision: 0, communities: [{ address: 'aww.bso' }] })).toBeNull();
    expect(normalizeStarterCommunityList({ schemaVersion: 2, revision: Number.MAX_SAFE_INTEGER + 1, communities: [{ address: 'aww.bso' }] })).toBeNull();
    expect(normalizeStarterCommunityList({ schemaVersion: 1, revision: 1, communities: [{ address: 'aww.bso' }] })).toBeNull();
  });
});

describe('normalizeRemoteStarterCommunityList', () => {
  const payload = (revision: number) => ({
    schemaVersion: 2,
    revision,
    communities: [{ address: `revision-${revision}.bso` }],
  });

  const currentList = normalizeStarterCommunityList(payload(2));
  if (!currentList) throw new Error('Invalid test fixture');

  it('never replaces an accepted list with an older revision', () => {
    expect(normalizeRemoteStarterCommunityList(payload(1), currentList)).toBeNull();
    expect(normalizeRemoteStarterCommunityList(payload(2), currentList)).toMatchObject({ revision: 2 });
    expect(normalizeRemoteStarterCommunityList(payload(3), currentList)).toMatchObject({ revision: 3 });
  });

  it('requires a new revision when community membership changes', () => {
    expect(() => normalizeRemoteStarterCommunityList({ ...payload(2), communities: [{ address: 'different.bso' }] }, currentList)).toThrow(
      'Default community membership changed without a new revision',
    );
  });

  it('throws for a malformed successful response so the caller enters its fallback state', () => {
    expect(() => normalizeRemoteStarterCommunityList({ schemaVersion: 2, revision: 2, communities: [] }, currentList)).toThrow('Invalid default communities response');
  });
});
