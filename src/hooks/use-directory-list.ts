import { useSyncExternalStore } from 'react';
import { getVendoredDirectoryList, vendoredDirectoryDefaults } from '../lib/utils/vendored-directory-lists';
import { isDirectoryCode, type SeeditDirectoryCode } from '../lib/utils/directory-codes';
import { normalizeRemoteDirectoryList, type DirectoryList } from '../lib/utils/directory-list-utils';

const GITHUB_URL_TEMPLATE = 'https://raw.githubusercontent.com/bitsocialnet/lists/master/seedit-directories/seedit-{code}-directory.json';
const REVALIDATE_INTERVAL_MS = 60 * 60 * 1000;
const FETCH_RETRY_DELAY_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 10 * 1000;

export interface DirectoryListState {
  list: DirectoryList | null;
  loading: boolean;
  error: Error | null;
}

interface DirectoryListStore {
  directoryCode: SeeditDirectoryCode;
  snapshot: DirectoryListState;
  listeners: Set<() => void>;
  inFlightFetch: Promise<void> | null;
  revalidationTimer: ReturnType<typeof globalThis.setTimeout> | null;
  lastFetchSuccessAt: number;
  lastFetchAttemptAt: number;
  handleVisibilityChange: () => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => DirectoryListState;
}

const EMPTY_SNAPSHOT: DirectoryListState = { list: null, loading: false, error: null };
const emptySubscribe = () => () => undefined;
const getEmptySnapshot = () => EMPTY_SNAPSHOT;
const stores = new Map<SeeditDirectoryCode, DirectoryListStore>();

const emit = (store: DirectoryListStore) => store.listeners.forEach((listener) => listener());

const setSnapshot = (store: DirectoryListStore, snapshot: DirectoryListState) => {
  store.snapshot = snapshot;
  emit(store);
};

const getNextRevalidationDelay = (store: DirectoryListStore): number => {
  const now = Date.now();
  if (store.lastFetchSuccessAt > 0 && now - store.lastFetchSuccessAt < REVALIDATE_INTERVAL_MS) {
    return REVALIDATE_INTERVAL_MS - (now - store.lastFetchSuccessAt);
  }
  if (store.lastFetchAttemptAt > 0 && now - store.lastFetchAttemptAt < FETCH_RETRY_DELAY_MS) {
    return FETCH_RETRY_DELAY_MS - (now - store.lastFetchAttemptAt);
  }
  return 0;
};

const scheduleRevalidation = (store: DirectoryListStore) => {
  if (store.revalidationTimer) globalThis.clearTimeout(store.revalidationTimer);
  store.revalidationTimer = null;
  if (store.listeners.size === 0) return;

  store.revalidationTimer = globalThis.setTimeout(() => {
    store.revalidationTimer = null;
    const request = revalidateDirectoryList(store.directoryCode);
    if (!request) scheduleRevalidation(store);
  }, getNextRevalidationDelay(store));
};

export const fetchDirectoryListPayload = (directoryCode: SeeditDirectoryCode, timeoutMs = FETCH_TIMEOUT_MS): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const url = GITHUB_URL_TEMPLATE.replace('{code}', directoryCode);

  return fetch(url, { cache: 'no-cache', signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Directory list request failed with ${response.status}`);
      return response.json();
    })
    .finally(() => globalThis.clearTimeout(timeout));
};

const shouldRevalidate = (store: DirectoryListStore): boolean => {
  const now = Date.now();
  if (store.lastFetchSuccessAt > 0 && now - store.lastFetchSuccessAt < REVALIDATE_INTERVAL_MS) return false;
  return store.lastFetchAttemptAt === 0 || now - store.lastFetchAttemptAt >= FETCH_RETRY_DELAY_MS;
};

export const revalidateDirectoryList = (directoryCode: SeeditDirectoryCode): Promise<void> | null => {
  const store = getDirectoryListStore(directoryCode);
  if (store.inFlightFetch) return store.inFlightFetch;
  if (!shouldRevalidate(store)) return null;

  store.lastFetchAttemptAt = Date.now();
  setSnapshot(store, { ...store.snapshot, loading: true, error: null });

  const request = fetchDirectoryListPayload(directoryCode)
    .then((payload) => {
      const currentList = store.snapshot.list ?? getVendoredDirectoryList(directoryCode);
      if (!currentList) throw new Error(`Missing vendored Seedit directory list: ${directoryCode}`);

      const remoteList = normalizeRemoteDirectoryList(payload, directoryCode, currentList, vendoredDirectoryDefaults);
      store.lastFetchSuccessAt = Date.now();
      setSnapshot(store, { list: remoteList ?? currentList, loading: false, error: null });
    })
    .catch((error) => {
      setSnapshot(store, {
        ...store.snapshot,
        loading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    })
    .finally(() => {
      store.inFlightFetch = null;
      scheduleRevalidation(store);
    });

  store.inFlightFetch = request;
  return request;
};

const createDirectoryListStore = (directoryCode: SeeditDirectoryCode): DirectoryListStore => {
  const fallback = getVendoredDirectoryList(directoryCode);
  if (!fallback) throw new Error(`Missing vendored Seedit directory list: ${directoryCode}`);

  const store = {
    directoryCode,
    snapshot: { list: fallback, loading: true, error: null },
    listeners: new Set<() => void>(),
    inFlightFetch: null,
    revalidationTimer: null,
    lastFetchSuccessAt: 0,
    lastFetchAttemptAt: 0,
  } as DirectoryListStore;

  store.getSnapshot = () => store.snapshot;
  store.handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') void revalidateDirectoryList(directoryCode);
  };
  store.subscribe = (listener) => {
    store.listeners.add(listener);
    if (store.listeners.size === 1 && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', store.handleVisibilityChange);
    }
    const request = revalidateDirectoryList(directoryCode);
    if (!request) scheduleRevalidation(store);

    return () => {
      store.listeners.delete(listener);
      if (store.listeners.size === 0 && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', store.handleVisibilityChange);
      }
      if (store.listeners.size === 0 && store.revalidationTimer) {
        globalThis.clearTimeout(store.revalidationTimer);
        store.revalidationTimer = null;
      }
    };
  };

  return store;
};

const getDirectoryListStore = (directoryCode: SeeditDirectoryCode): DirectoryListStore => {
  const existing = stores.get(directoryCode);
  if (existing) return existing;

  const store = createDirectoryListStore(directoryCode);
  stores.set(directoryCode, store);
  return store;
};

export const getDirectoryListSnapshot = (directoryCode: string | undefined): DirectoryListState =>
  directoryCode && isDirectoryCode(directoryCode) ? getDirectoryListStore(directoryCode).getSnapshot() : EMPTY_SNAPSHOT;

export const subscribeToDirectoryList = (directoryCode: SeeditDirectoryCode, listener: () => void): (() => void) =>
  getDirectoryListStore(directoryCode).subscribe(listener);

/** Read a route-only directory list. This hook never reads or writes account state. */
export const useDirectoryList = (directoryCode: string | undefined): DirectoryListState => {
  const store = directoryCode && isDirectoryCode(directoryCode) ? getDirectoryListStore(directoryCode) : null;
  return useSyncExternalStore(store?.subscribe ?? emptySubscribe, store?.getSnapshot ?? getEmptySnapshot, store?.getSnapshot ?? getEmptySnapshot);
};
