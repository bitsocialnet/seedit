import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProviderId, UploadMode } from '../lib/media-hosting';

interface MediaHostingStore {
  uploadMode: UploadMode;
  preferredProvider: ProviderId;
  setUploadMode: (mode: UploadMode) => void;
  setPreferredProvider: (provider: ProviderId) => void;
}

// Forge Images is the default everywhere: it is the one provider the web app can upload to,
// and the desktop and Android apps can switch to another provider or Random in the preferences.
const useMediaHostingStore = create<MediaHostingStore>()(
  persist(
    (set) => ({
      uploadMode: 'preferred',
      preferredProvider: 'forge',
      setUploadMode: (mode) => set({ uploadMode: mode }),
      setPreferredProvider: (provider) => set({ preferredProvider: provider }),
    }),
    { name: 'media-hosting-storage' },
  ),
);

export default useMediaHostingStore;
