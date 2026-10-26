import type { MediaHostingRuntime, ProviderId, UploadMode } from './types';
import { getRuntimeProviders } from './providers';
import type { ProviderAvailabilitySnapshot } from './provider-availability';

/** Fisher-Yates shuffle. Returns a new shuffled copy. */
export function getRandomOrder(providers: readonly ProviderId[], rng: () => number = Math.random): ProviderId[] {
  const result = [...providers];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Maps stored settings to what the runtime can honor: Random needs at least two providers,
 * and a preferred provider the runtime cannot use falls back to the first one it can.
 */
export function resolveUploadSettings(options: { mode: UploadMode; preferredProvider: ProviderId; runtime: MediaHostingRuntime }): {
  mode: UploadMode;
  preferredProvider: ProviderId;
} {
  const providers = getRuntimeProviders(options.runtime).map((provider) => provider.id);
  return {
    mode: options.mode === 'random' && providers.length < 2 ? 'preferred' : options.mode,
    preferredProvider: providers.includes(options.preferredProvider) ? options.preferredProvider : (providers[0] ?? options.preferredProvider),
  };
}

/** Providers the stored settings enable on this runtime, minus any known to be unreachable, in display order. */
export function getEnabledProviders(options: {
  mode: UploadMode;
  preferredProvider: ProviderId;
  runtime: MediaHostingRuntime;
  availability?: ProviderAvailabilitySnapshot;
}): ProviderId[] {
  const { runtime, availability } = options;
  const { mode, preferredProvider } = resolveUploadSettings(options);
  const supported = getRuntimeProviders(runtime)
    .map((provider) => provider.id)
    .filter((provider) => availability?.[provider] !== 'unavailable');

  if (mode === 'preferred') {
    return supported.includes(preferredProvider) ? [preferredProvider] : [];
  }
  if (mode === 'random') {
    return supported;
  }
  return [];
}

/** Get ordered provider list for an upload attempt */
export function getProviderOrder(options: Parameters<typeof getEnabledProviders>[0]): ProviderId[] {
  const providers = getEnabledProviders(options);
  return resolveUploadSettings(options).mode === 'random' ? getRandomOrder(providers) : providers;
}
