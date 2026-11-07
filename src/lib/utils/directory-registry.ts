// Which directories exist, and their display metadata, come from the published defaults file in
// bitsocialnet/lists, so a release keeps learning about directories added after it was built.
// The bundled defaults and lists remain the offline fallback.

import { getDirectoryCodes, isWellFormedDirectoryCode, setPublishedDirectoryCodes, type SeeditDirectoryCode } from './directory-codes';
import { normalizeDirectoryDefaultsData, type DirectoryDefaultsData } from './directory-list-utils';
import { vendoredDirectoryDefaults } from './vendored-directory-lists';

export const DIRECTORY_DEFAULTS_URL = 'https://raw.githubusercontent.com/bitsocialnet/lists/master/seedit-directories/seedit-directories-defaults.json';
const CACHE_KEY = 'seedit-directory-defaults-cache';
const REVALIDATE_INTERVAL_MS = 60 * 60 * 1000;
const FETCH_RETRY_DELAY_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 10 * 1000;

export interface DirectoryRegistrySnapshot {
  codes: readonly SeeditDirectoryCode[];
  defaults: DirectoryDefaultsData;
  /** False until this page load's first defaults request finishes, even when a cached copy already supplies codes. */
  settled: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * Keep only entries whose key names a usable directory and whose raw entry states that same code. The normalizer
 * fills a missing code from the key, so the raw entry is checked rather than the normalized one.
 */
export const normalizePublishedDirectoryDefaults = (raw: unknown): DirectoryDefaultsData | null => {
  const rawDirectories = isRecord(raw) && isRecord(raw.directories) ? raw.directories : {};
  const normalized = normalizeDirectoryDefaultsData(raw);
  const directories = Object.fromEntries(
    Object.entries(normalized.directories).filter(([code]) => {
      const rawEntry = isWellFormedDirectoryCode(code) ? rawDirectories[code] : undefined;
      return isRecord(rawEntry) && rawEntry.directoryCode === code;
    }),
  );
  return Object.keys(directories).length > 0 ? { ...normalized, directories } : null;
};

const mergeWithVendoredDefaults = (published: DirectoryDefaultsData | null): DirectoryDefaultsData =>
  published
    ? { ...vendoredDirectoryDefaults, ...published, directories: { ...vendoredDirectoryDefaults.directories, ...published.directories } }
    : vendoredDirectoryDefaults;

const readCachedDefaults = (): DirectoryDefaultsData | null => {
  try {
    const cached = globalThis.localStorage?.getItem(CACHE_KEY);
    return cached ? normalizePublishedDirectoryDefaults(JSON.parse(cached)) : null;
  } catch {
    return null;
  }
};

const writeCachedDefaults = (defaults: DirectoryDefaultsData) => {
  try {
    globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(defaults));
  } catch {
    // Storage can be full or blocked; the in-memory copy still serves this session.
  }
};

let publishedDefaults = readCachedDefaults();
if (publishedDefaults) setPublishedDirectoryCodes(Object.keys(publishedDefaults.directories));

const createSnapshot = (settled: boolean): DirectoryRegistrySnapshot => ({
  codes: getDirectoryCodes(),
  defaults: mergeWithVendoredDefaults(publishedDefaults),
  settled,
});

// A cached copy can predate a directory published since, so only this page load's request settles the codes.
let snapshot = createSnapshot(false);
const listeners = new Set<() => void>();
let inFlightFetch: Promise<void> | null = null;
let revalidationTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
let lastFetchSuccessAt = 0;
let lastFetchAttemptAt = 0;

export const getDirectoryRegistrySnapshot = (): DirectoryRegistrySnapshot => snapshot;

export const fetchPublishedDirectoryDefaults = (timeoutMs = FETCH_TIMEOUT_MS): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(DIRECTORY_DEFAULTS_URL, { cache: 'no-cache', signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Directory defaults request failed with ${response.status}`);
      return response.json();
    })
    .finally(() => globalThis.clearTimeout(timeout));
};

const shouldRevalidate = (): boolean => {
  const now = Date.now();
  if (lastFetchSuccessAt > 0 && now - lastFetchSuccessAt < REVALIDATE_INTERVAL_MS) return false;
  return lastFetchAttemptAt === 0 || now - lastFetchAttemptAt >= FETCH_RETRY_DELAY_MS;
};

const getNextRevalidationDelay = (): number => {
  const now = Date.now();
  if (lastFetchSuccessAt > 0 && now - lastFetchSuccessAt < REVALIDATE_INTERVAL_MS) return REVALIDATE_INTERVAL_MS - (now - lastFetchSuccessAt);
  if (lastFetchAttemptAt > 0 && now - lastFetchAttemptAt < FETCH_RETRY_DELAY_MS) return FETCH_RETRY_DELAY_MS - (now - lastFetchAttemptAt);
  return 0;
};

/** While anything is subscribed, refresh hourly (or retry after a failure) even if the tab never changes visibility. */
const scheduleRevalidation = () => {
  if (revalidationTimer) globalThis.clearTimeout(revalidationTimer);
  revalidationTimer = null;
  if (listeners.size === 0) return;

  revalidationTimer = globalThis.setTimeout(() => {
    revalidationTimer = null;
    if (!revalidateDirectoryRegistry()) scheduleRevalidation();
  }, getNextRevalidationDelay());
};

/** Refresh the published defaults at most hourly. The returned request never rejects. */
export const revalidateDirectoryRegistry = (): Promise<void> | null => {
  if (inFlightFetch) return inFlightFetch;
  if (!shouldRevalidate()) return null;

  lastFetchAttemptAt = Date.now();
  let changed = false;
  inFlightFetch = fetchPublishedDirectoryDefaults()
    .then((payload) => {
      const remoteDefaults = normalizePublishedDirectoryDefaults(payload);
      if (!remoteDefaults) throw new Error('Invalid directory defaults response');
      lastFetchSuccessAt = Date.now();
      // A lagging CDN edge can serve an older file than the one already cached.
      if ((remoteDefaults.updatedAt ?? 0) < (publishedDefaults?.updatedAt ?? 0)) return;

      changed = JSON.stringify(remoteDefaults) !== JSON.stringify(publishedDefaults);
      publishedDefaults = remoteDefaults;
      setPublishedDirectoryCodes(Object.keys(remoteDefaults.directories));
      writeCachedDefaults(remoteDefaults);
    })
    .catch((error) => console.warn('Failed to refresh Seedit directory defaults:', error))
    .finally(() => {
      inFlightFetch = null;
      // Hourly refreshes usually change nothing; only a change, or the first settle, re-renders subscribers.
      if (changed || !snapshot.settled) {
        snapshot = createSnapshot(true);
        listeners.forEach((listener) => listener());
      }
      scheduleRevalidation();
    });

  return inFlightFetch;
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') void revalidateDirectoryRegistry();
};

export const subscribeToDirectoryRegistry = (listener: () => void): (() => void) => {
  listeners.add(listener);
  if (listeners.size === 1 && typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibilityChange);
  if (!revalidateDirectoryRegistry()) scheduleRevalidation();

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (revalidationTimer) globalThis.clearTimeout(revalidationTimer);
    revalidationTimer = null;
  };
};
