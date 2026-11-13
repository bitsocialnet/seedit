import { getRuntimeProviders, MEDIA_HOSTING_PROVIDERS } from './providers';
import type { MediaHostingRuntime, ProviderId } from './types';

export type ProviderAvailabilityStatus = 'unknown' | 'checking' | 'available' | 'unavailable';
export type ProviderAvailabilitySnapshot = Partial<Record<ProviderId, ProviderAvailabilityStatus>>;

const PROBE_TIMEOUT_MS = 5_000;
const PROBE_CACHE_MS = 10 * 60_000;
// A failed probe is often a passing outage or a slow network, so it is trusted for much less time.
const UNAVAILABLE_CACHE_MS = 30_000;

type Listener = () => void;

interface ProviderAvailabilityEntry {
  status: ProviderAvailabilityStatus;
  checkedAt: number;
}

const providerById = new Map(MEDIA_HOSTING_PROVIDERS.map((provider) => [provider.id, provider]));
let entries: Record<ProviderId, ProviderAvailabilityEntry> = Object.fromEntries(
  MEDIA_HOSTING_PROVIDERS.map((provider) => [provider.id, { status: 'unknown', checkedAt: 0 }]),
) as Record<ProviderId, ProviderAvailabilityEntry>;
let snapshot: ProviderAvailabilitySnapshot = buildSnapshot();
const listeners = new Set<Listener>();
const inFlight = new Map<ProviderId, Promise<ProviderAvailabilityStatus>>();
const retryTimers = new Map<ProviderId, number>();

function buildSnapshot(): ProviderAvailabilitySnapshot {
  return Object.fromEntries(MEDIA_HOSTING_PROVIDERS.map((provider) => [provider.id, entries[provider.id]?.status ?? 'unknown'])) as ProviderAvailabilitySnapshot;
}

function emit() {
  snapshot = buildSnapshot();
  for (const listener of listeners) {
    listener();
  }
}

function setProviderStatus(provider: ProviderId, status: ProviderAvailabilityStatus) {
  entries = {
    ...entries,
    [provider]: {
      status,
      checkedAt: status === 'checking' ? entries[provider].checkedAt : Date.now(),
    },
  };
  emit();
}

function shouldProbeProvider(provider: ProviderId): boolean {
  if (inFlight.has(provider)) return false;
  const entry = entries[provider];
  const maxAge = entry.status === 'unavailable' ? UNAVAILABLE_CACHE_MS : PROBE_CACHE_MS;
  return entry.status === 'unknown' || Date.now() - entry.checkedAt > maxAge;
}

/** Expires an unavailable result after UNAVAILABLE_CACHE_MS and probes it again, for as long as something shows its status. */
function scheduleRetry(provider: ProviderId) {
  window.clearTimeout(retryTimers.get(provider));
  const timeoutId = window.setTimeout(() => {
    retryTimers.delete(provider);
    if (entries[provider].status !== 'unavailable') return;
    // The timer, not Date.now(), ends the result's lifetime: the wall clock can lag the timer clock, and the retries would stop.
    entries = { ...entries, [provider]: { ...entries[provider], checkedAt: 0 } };
    if (listeners.size > 0) void probeProviderAvailability(provider);
  }, UNAVAILABLE_CACHE_MS);
  retryTimers.set(provider, timeoutId);
}

function probeImageUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const timeoutId = window.setTimeout(() => settle(false), PROBE_TIMEOUT_MS);

    const settle = (available: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      image.onload = null;
      image.onerror = null;
      resolve(available);
    };

    image.onload = () => settle(true);
    image.onerror = () => settle(false);
    image.referrerPolicy = 'no-referrer';
    image.src = url;
  });
}

export function getProviderAvailabilitySnapshot(): ProviderAvailabilitySnapshot {
  return snapshot;
}

export function subscribeProviderAvailability(listener: Listener, runtime?: MediaHostingRuntime): () => void {
  listeners.add(listener);
  if (runtime) {
    startProviderAvailabilityProbes(runtime);
  }
  return () => {
    listeners.delete(listener);
  };
}

function startProviderAvailabilityProbes(runtime: MediaHostingRuntime) {
  for (const { id } of getRuntimeProviders(runtime)) {
    if (shouldProbeProvider(id)) {
      void probeProviderAvailability(id);
    }
  }
}

export async function probeProviderAvailability(provider: ProviderId): Promise<ProviderAvailabilityStatus> {
  const running = inFlight.get(provider);
  if (running) return running;

  const definition = providerById.get(provider);
  if (!definition) return 'unavailable';
  if (!shouldProbeProvider(provider)) return entries[provider].status;

  const promise = (async () => {
    // A re-probe keeps the last result, so a provider that is still down does not turn selectable while it runs.
    if (entries[provider].status === 'unknown') setProviderStatus(provider, 'checking');

    if (!definition.availabilityProbeUrls.length) {
      setProviderStatus(provider, 'available');
      return 'available' as const;
    }
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      setProviderStatus(provider, 'unknown');
      return 'unknown' as const;
    }

    const results = await Promise.all(definition.availabilityProbeUrls.map((url) => probeImageUrl(url)));
    const status: ProviderAvailabilityStatus = results.every(Boolean) ? 'available' : 'unavailable';
    setProviderStatus(provider, status);
    if (status === 'unavailable') scheduleRetry(provider);
    return status;
  })();

  inFlight.set(provider, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(provider);
  }
}

export async function ensureProviderAvailability(runtime: MediaHostingRuntime): Promise<ProviderAvailabilitySnapshot> {
  await Promise.all(getRuntimeProviders(runtime).map((provider) => probeProviderAvailability(provider.id)));
  return getProviderAvailabilitySnapshot();
}

export function resetProviderAvailabilityForTests() {
  entries = Object.fromEntries(MEDIA_HOSTING_PROVIDERS.map((provider) => [provider.id, { status: 'unknown', checkedAt: 0 }])) as Record<
    ProviderId,
    ProviderAvailabilityEntry
  >;
  inFlight.clear();
  for (const timeoutId of retryTimers.values()) window.clearTimeout(timeoutId);
  retryTimers.clear();
  emit();
}
