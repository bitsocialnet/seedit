import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIRECTORY_DEFAULTS_URL } from '../lib/utils/directory-registry';
import { fetchDirectoryListPayload, getDirectoryListSnapshot, revalidateDirectoryList, subscribeToDirectoryList } from './use-directory-list';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// List revalidation also refreshes the published directory defaults; count only list requests.
const countListRequests = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.filter(([url]) => url !== DIRECTORY_DEFAULTS_URL).length;

describe('fetchDirectoryListPayload', () => {
  it('requests the matching GitHub list without using a cached response', async () => {
    const payload = { schemaVersion: 1, revision: 1, communities: [{ address: 'funny-posting.bso' }] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(payload) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchDirectoryListPayload('funny')).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/bitsocialnet/lists/master/seedit-directories/seedit-funny-directory.json',
      expect.objectContaining({ cache: 'no-cache', signal: expect.any(AbortSignal) }),
    );
  });

  it('rejects HTTP failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchDirectoryListPayload('funny')).rejects.toThrow('Directory list request failed with 503');
  });
});

describe('directory list revalidation', () => {
  it('retains the vendored snapshot when remote data is invalid', async () => {
    const fallback = getDirectoryListSnapshot('aww').list;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ communities: [] }) }));

    await revalidateDirectoryList('aww');

    const snapshot = getDirectoryListSnapshot('aww');
    expect(snapshot.list).toBe(fallback);
    expect(snapshot.list?.communities[0]?.address).toBe('aww-posting.bso');
    expect(snapshot.error?.message).toMatch(/Invalid directory list response/);
  });

  it('deduplicates in-flight requests and throttles a successful snapshot for one hour', async () => {
    let resolveFetch: ((response: unknown) => void) | undefined;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = revalidateDirectoryList('videos');
    const second = revalidateDirectoryList('videos');
    expect(second).toBe(first);

    resolveFetch?.({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          schemaVersion: 1,
          revision: 1,
          directoryCode: 'videos',
          communities: [{ address: 'videos-posting.bso', addedAt: 1783123200 }],
        }),
    });
    await first;

    expect(getDirectoryListSnapshot('videos')).toMatchObject({ loading: false, error: null, list: { revision: 1 } });
    expect(revalidateDirectoryList('videos')).toBeNull();
    expect(countListRequests(fetchMock)).toBe(1);
  });

  it('revalidates hourly while a visible subscriber remains mounted', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T00:00:00Z'));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          schemaVersion: 1,
          revision: 1,
          directoryCode: 'gaming',
          communities: [{ address: 'gaming-posting.bso', addedAt: 1783123200 }],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const unsubscribe = subscribeToDirectoryList('gaming', () => undefined);
    await revalidateDirectoryList('gaming');
    expect(countListRequests(fetchMock)).toBe(1);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(countListRequests(fetchMock)).toBe(2);
    unsubscribe();
  });
});
