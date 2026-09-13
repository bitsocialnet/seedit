import { useMemo, useSyncExternalStore } from 'react';
import useContentOptionsStore from '../stores/use-content-options-store';
import vendoredStarterCommunities from '../data/seedit-starter-communities.json';
import {
  fetchStarterCommunitiesPayload,
  normalizeRemoteStarterCommunityList,
  normalizeStarterCommunityList,
  type DefaultSubscription,
  type StarterCommunityList,
} from '../lib/utils/starter-community-list';

const REVALIDATE_INTERVAL_MS = 60 * 60 * 1000;

interface StarterCommunityListSnapshot {
  list: StarterCommunityList;
  loading: boolean;
  error: Error | null;
}

const vendoredList = normalizeStarterCommunityList(vendoredStarterCommunities);
if (!vendoredList) {
  throw new Error('Invalid vendored Seedit default communities list');
}

let snapshot: StarterCommunityListSnapshot = { list: vendoredList, loading: true, error: null };
let lastFetchAt = 0;
let inFlightFetch: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const fetchStarterCommunities = () => {
  if (inFlightFetch || Date.now() - lastFetchAt < REVALIDATE_INTERVAL_MS) return inFlightFetch;

  snapshot = { ...snapshot, loading: true, error: null };
  emit();
  lastFetchAt = Date.now();

  inFlightFetch = fetchStarterCommunitiesPayload()
    .then((payload) => {
      const remoteList = normalizeRemoteStarterCommunityList(payload, snapshot.list);
      if (remoteList) {
        snapshot = { list: remoteList, loading: false, error: null };
      } else {
        snapshot = { ...snapshot, loading: false, error: null };
      }
    })
    .catch((error) => {
      snapshot = { ...snapshot, loading: false, error: error instanceof Error ? error : new Error(String(error)) };
    })
    .finally(() => {
      inFlightFetch = null;
      emit();
    });

  return inFlightFetch;
};

const handleVisibilityChange = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') void fetchStarterCommunities();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1 && typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibilityChange);
  void fetchStarterCommunities();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};

const getSnapshot = () => snapshot;

export const useStarterCommunityList = (): StarterCommunityListSnapshot => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

export const useDefaultSubscriptions = (): DefaultSubscription[] => useStarterCommunityList().list.communities;

export const useFilteredDefaultSubscriptions = (): DefaultSubscription[] => {
  const defaultSubscriptions = useDefaultSubscriptions();
  const { hideNsfwCommunities } = useContentOptionsStore();

  return useMemo(
    () => (hideNsfwCommunities ? defaultSubscriptions.filter((subscription) => !subscription.nsfw) : defaultSubscriptions),
    [defaultSubscriptions, hideNsfwCommunities],
  );
};

export const useDefaultSubscriptionAddresses = (): string[] => {
  const subscriptions = useFilteredDefaultSubscriptions();
  return useMemo(() => subscriptions.map(({ address }) => address), [subscriptions]);
};

export const useDefaultSubscriptionsMetadata = () => {
  const { list } = useStarterCommunityList();
  return useMemo(
    () => ({ title: list.title, description: list.description, createdAt: list.createdAt, updatedAt: list.updatedAt, revision: list.revision }),
    [list.title, list.description, list.createdAt, list.updatedAt, list.revision],
  );
};

export const useDefaultSubscriptionTags = (subscriptions: DefaultSubscription[]) =>
  useMemo(() => [...new Set(subscriptions.flatMap(({ tags }) => tags ?? []))].sort(), [subscriptions]);
