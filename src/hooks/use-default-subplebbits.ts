import { useEffect, useMemo, useState } from 'react';
import { Subplebbit } from '@bitsocialnet/bitsocial-react-hooks';
import useContentOptionsStore from '../stores/use-content-options-store';

export interface MultisubMetadata {
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface MultisubSubplebbit {
  title?: string;
  address: string;
  tags?: string[];
  features?: string[];
  seeditAutoSubscribe?: boolean;
  plebchanAutoSubscribe?: boolean;
  lowUptime?: boolean;
}

let cacheSubplebbits: MultisubSubplebbit[] | null = null;
let cacheMetadata: MultisubMetadata | null = null;
let cacheAutoSubscribeAddresses: string[] | null = null;
let pending = false;

// Subscriber pattern for notifying all hook instances
const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach((callback) => callback());
};

// Shared fetch function to avoid duplication
const fetchMultisubData = async () => {
  if (pending) {
    return;
  }
  pending = true;

  try {
    const multisub = await fetch(
      'https://raw.githubusercontent.com/plebbit/lists/master/default-multisub.json',
      // { cache: 'no-cache' }
    ).then((res) => res.json());

    const filteredSubplebbits = multisub.subplebbits.filter((sub: MultisubSubplebbit) => !sub.lowUptime);

    cacheSubplebbits = filteredSubplebbits;

    // Cache auto-subscribe addresses when we fetch subplebbits
    cacheAutoSubscribeAddresses = filteredSubplebbits
      .filter((sub: MultisubSubplebbit) => sub.seeditAutoSubscribe && sub.address)
      .map((sub: MultisubSubplebbit) => sub.address);

    // Also cache metadata since we have the full response
    const { title, description, createdAt, updatedAt } = multisub;
    cacheMetadata = { title, description, createdAt, updatedAt };

    // Notify all subscribers that cache has been updated
    notifySubscribers();

    return { subplebbits: filteredSubplebbits, metadata: cacheMetadata };
  } catch (e) {
    console.warn(e);
    return null;
  } finally {
    pending = false;
  }
};

export const useDefaultSubplebbits = () => {
  const [subplebbits, setSubplebbits] = useState<MultisubSubplebbit[]>(cacheSubplebbits || []);

  useEffect(() => {
    // If we already have cached data, use it immediately
    if (cacheSubplebbits) {
      setSubplebbits(cacheSubplebbits);
      return;
    }

    // Subscribe to cache updates
    const handleCacheUpdate = () => {
      if (cacheSubplebbits) {
        setSubplebbits(cacheSubplebbits);
      }
    };

    subscribers.add(handleCacheUpdate);

    // Trigger fetch if no cache and not pending
    if (!pending) {
      fetchMultisubData();
    }

    // Cleanup subscription
    return () => {
      subscribers.delete(handleCacheUpdate);
    };
  }, []);

  return subplebbits;
};

export const getAutoSubscribeAddresses = () => cacheAutoSubscribeAddresses || [];

export const useDefaultSubplebbitAddresses = () => {
  const defaultSubplebbits = useDefaultSubplebbits();
  const { hideAdultCommunities, hideGoreCommunities, hideAntiCommunities, hideVulgarCommunities } = useContentOptionsStore();

  const filteredSubplebbits = useMemo(() => {
    return defaultSubplebbits.filter((subplebbit: Subplebbit) => {
      const tags = subplebbit.tags || [];
      if (hideAdultCommunities && tags.includes('adult')) return false;
      if (hideGoreCommunities && tags.includes('gore')) return false;
      if (hideAntiCommunities && tags.includes('anti')) return false;
      if (hideVulgarCommunities && tags.includes('vulgar')) return false;
      return true;
    });
  }, [defaultSubplebbits, hideAdultCommunities, hideGoreCommunities, hideAntiCommunities, hideVulgarCommunities]);

  return useMemo(() => filteredSubplebbits.map((subplebbit) => subplebbit.address), [filteredSubplebbits]);
};

export const useMultisubMetadata = () => {
  const [metadata, setMetadata] = useState<MultisubMetadata | null>(cacheMetadata || null);

  useEffect(() => {
    // If we already have cached data, use it immediately
    if (cacheMetadata) {
      setMetadata(cacheMetadata);
      return;
    }

    // Subscribe to cache updates
    const handleCacheUpdate = () => {
      if (cacheMetadata) {
        setMetadata(cacheMetadata);
      }
    };

    subscribers.add(handleCacheUpdate);

    // Trigger fetch if no cache and not pending
    if (!pending) {
      fetchMultisubData();
    }

    // Cleanup subscription
    return () => {
      subscribers.delete(handleCacheUpdate);
    };
  }, []);

  return metadata;
};

const getUniqueTags = (multisub: any) => {
  const allTags = new Set<string>();
  Object.values(multisub).forEach((sub: any) => {
    if (sub?.tags?.length) {
      sub.tags.forEach((tag: string) => allTags.add(tag));
    }
  });
  return Array.from(allTags).sort();
};

export const useDefaultSubplebbitTags = (subplebbits: any) => {
  return useMemo(() => getUniqueTags(subplebbits), [subplebbits]);
};
