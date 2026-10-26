import { useSyncExternalStore } from 'react';
import { getProviderAvailabilitySnapshot, subscribeProviderAvailability, type MediaHostingRuntime } from '../lib/media-hosting';

/** Probes the runtime's providers on first subscribe and returns their reachability. */
export function useProviderAvailability(runtime: MediaHostingRuntime) {
  return useSyncExternalStore((listener) => subscribeProviderAvailability(listener, runtime), getProviderAvailabilitySnapshot, getProviderAvailabilitySnapshot);
}
