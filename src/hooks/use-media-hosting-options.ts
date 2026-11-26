import { getMediaHostingRuntime, getRuntimeProviders, resolveUploadSettings, type ProviderId } from '../lib/media-hosting';
import useMediaHostingStore from '../stores/use-media-hosting-store';
import { useProviderAvailability } from './use-provider-availability';

/** Where uploads go: a random provider, a preferred one, or none. Both interfaces' settings pages use it. */
const useMediaHostingOptions = () => {
  const storedUploadMode = useMediaHostingStore((state) => state.uploadMode);
  const storedPreferredProvider = useMediaHostingStore((state) => state.preferredProvider);
  const setUploadMode = useMediaHostingStore((state) => state.setUploadMode);
  const setPreferredProvider = useMediaHostingStore((state) => state.setPreferredProvider);
  const runtime = getMediaHostingRuntime();
  // Only the providers this runtime can upload to: the web app has no CORS-free route to the others.
  const providers = getRuntimeProviders(runtime);
  const { mode, preferredProvider } = resolveUploadSettings({ mode: storedUploadMode, preferredProvider: storedPreferredProvider, runtime });
  const availability = useProviderAvailability(runtime);

  return {
    runtime,
    providers,
    mode,
    preferredProvider,
    isUnavailable: (id: ProviderId) => availability[id] === 'unavailable',
    // A lone provider stays selectable: a probe that failed on a slow network or behind a blocker
    // would otherwise leave no way back from None, and uploads try it regardless.
    isSelectable: (id: ProviderId) => !(availability[id] === 'unavailable' && providers.length > 1),
    selectRandom: () => setUploadMode('random'),
    selectNone: () => setUploadMode('none'),
    selectProvider: (id: ProviderId) => {
      setPreferredProvider(id);
      setUploadMode('preferred');
    },
  };
};

export default useMediaHostingOptions;
