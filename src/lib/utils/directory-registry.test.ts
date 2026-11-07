import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DEFAULTS_URL = 'https://raw.githubusercontent.com/bitsocialnet/lists/master/seedit-directories/seedit-directories-defaults.json';
const CACHE_KEY = 'seedit-directory-defaults-cache';

const publishedDefaults = (updatedAt: number, directories: Record<string, unknown>) => ({ schemaVersion: 1, revision: 1, updatedAt, directories });
const dogsDefaults = publishedDefaults(200, {
  funny: { directoryCode: 'funny', title: 'Funny' },
  dogs: { directoryCode: 'dogs', title: 'Dogs', description: 'Good dogs only.', tags: ['dogs'] },
});

const createStorage = (entries: Record<string, string> = {}) => {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
};

const okJson = (payload: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(payload) });

const loadModules = async () => {
  const registry = await import('./directory-registry');
  const codes = await import('./directory-codes');
  const lists = await import('../../hooks/use-directory-list');
  return { ...registry, ...codes, ...lists };
};

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('directory registry', () => {
  it('starts from the bundled codes and waits for published defaults when nothing is cached', async () => {
    vi.stubGlobal('localStorage', createStorage());
    const { getDirectoryRegistrySnapshot, VENDORED_DIRECTORY_CODES } = await loadModules();

    expect(getDirectoryRegistrySnapshot()).toMatchObject({ codes: VENDORED_DIRECTORY_CODES, settled: false });
  });

  it('learns a directory published after this build, with its metadata, and caches it', async () => {
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    const fetchMock = vi.fn().mockResolvedValue(okJson(dogsDefaults));
    vi.stubGlobal('fetch', fetchMock);
    const { getDirectoryRegistrySnapshot, isDirectoryCode, revalidateDirectoryRegistry, VENDORED_DIRECTORY_CODES } = await loadModules();

    await revalidateDirectoryRegistry();

    expect(fetchMock).toHaveBeenCalledWith(DEFAULTS_URL, expect.objectContaining({ cache: 'no-cache' }));
    expect(isDirectoryCode('dogs')).toBe(true);
    const snapshot = getDirectoryRegistrySnapshot();
    expect(snapshot.codes).toEqual([...VENDORED_DIRECTORY_CODES, 'dogs']);
    expect(snapshot.settled).toBe(true);
    expect(snapshot.defaults.directories.dogs).toMatchObject({ title: 'Dogs', description: 'Good dogs only.' });
    // bundled metadata for directories the published file omits stays available
    expect(snapshot.defaults.directories.cats?.title).toBe('Cats');
    expect(JSON.parse(storage.getItem(CACHE_KEY) ?? '{}').directories.dogs.title).toBe('Dogs');
    expect(revalidateDirectoryRegistry()).toBeNull();
  });

  it('keeps the same snapshot when a refresh publishes nothing new', async () => {
    vi.stubGlobal('localStorage', createStorage({ [CACHE_KEY]: JSON.stringify(dogsDefaults) }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson(dogsDefaults)));
    const { getDirectoryRegistrySnapshot, revalidateDirectoryRegistry } = await loadModules();
    const before = getDirectoryRegistrySnapshot();

    await revalidateDirectoryRegistry();

    expect(getDirectoryRegistrySnapshot()).toBe(before);
  });

  it('knows cached published directories before any network request', async () => {
    vi.stubGlobal('localStorage', createStorage({ [CACHE_KEY]: JSON.stringify(dogsDefaults) }));
    const { getDirectoryRegistrySnapshot, isDirectoryCode } = await loadModules();

    expect(isDirectoryCode('dogs')).toBe(true);
    expect(getDirectoryRegistrySnapshot().settled).toBe(true);
  });

  it('settles on the bundled codes when the published defaults cannot be fetched', async () => {
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const { getDirectoryRegistrySnapshot, revalidateDirectoryRegistry, VENDORED_DIRECTORY_CODES } = await loadModules();

    await revalidateDirectoryRegistry();

    expect(getDirectoryRegistrySnapshot()).toMatchObject({ codes: VENDORED_DIRECTORY_CODES, settled: true });
  });

  it('ignores a published file older than the cached one', async () => {
    vi.stubGlobal('localStorage', createStorage({ [CACHE_KEY]: JSON.stringify(dogsDefaults) }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson(publishedDefaults(100, { funny: { directoryCode: 'funny' } }))));
    const { isDirectoryCode, revalidateDirectoryRegistry } = await loadModules();

    await revalidateDirectoryRegistry();

    expect(isDirectoryCode('dogs')).toBe(true);
  });

  it('drops published entries that are not usable directory codes', async () => {
    const { normalizePublishedDirectoryDefaults } = await loadModules();

    const normalized = normalizePublishedDirectoryDefaults(
      publishedDefaults(1, {
        dogs: { directoryCode: 'dogs' },
        all: { directoryCode: 'all' },
        'dogs.bso': { directoryCode: 'dogs.bso' },
        birds: { directoryCode: 'parrots' },
      }),
    );

    expect(Object.keys(normalized?.directories ?? {})).toEqual(['dogs']);
    expect(normalizePublishedDirectoryDefaults({ directories: { all: { directoryCode: 'all' } } })).toBeNull();
  });

  it('loads the candidate list of a directory that has no bundled copy', async () => {
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url === DEFAULTS_URL
            ? okJson(dogsDefaults)
            : okJson({ schemaVersion: 1, revision: 1, directoryCode: 'dogs', communities: [{ address: 'good-dogs.bso', addedAt: 1 }] }),
        ),
      ),
    );
    const { getDirectoryListSnapshot, revalidateDirectoryList, revalidateDirectoryRegistry } = await loadModules();

    await revalidateDirectoryRegistry();
    expect(getDirectoryListSnapshot('dogs')).toMatchObject({ list: null, loading: true });

    await revalidateDirectoryList('dogs');

    expect(getDirectoryListSnapshot('dogs')).toMatchObject({
      loading: false,
      error: null,
      list: { directoryCode: 'dogs', title: 'Dogs', communities: [{ address: 'good-dogs.bso' }] },
    });
  });
});
