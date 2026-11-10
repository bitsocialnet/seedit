import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ContentOptionsState {
  blurNsfwThumbnails: boolean;
  hideNsfwCommunities: boolean;
  setBlurNsfwThumbnails: (blur: boolean) => void;
  setHideNsfwCommunities: (hide: boolean) => void;
  thumbnailDisplayOption: 'show' | 'hide' | 'community';
  setThumbnailDisplayOption: (option: 'show' | 'hide' | 'community') => void;
  mediaPreviewOption: 'autoExpandAll' | 'autoExpandExceptComments' | 'community';
  setMediaPreviewOption: (option: 'autoExpandAll' | 'autoExpandExceptComments' | 'community') => void;
  autoplayVideosOnComments: boolean;
  setAutoplayVideosOnComments: (autoplay: boolean) => void;
  muteVideosOnComments: boolean;
  setMuteVideosOnComments: (mute: boolean) => void;
  infiniteFeedEnabled: boolean | null;
  setInfiniteFeedEnabled: (enabled: boolean) => void;
  autoHideTopbar: boolean | null;
  setAutoHideTopbar: (enabled: boolean) => void;
}

interface ContentOptionsStore extends ContentOptionsState {
  hideDefaultCommunities: boolean;
  setHideDefaultCommunities: (hide: boolean) => void;
  enableLocalNotifications: boolean;
  setEnableLocalNotifications: (enable: boolean) => void;
}

const useContentOptionsStore = create<ContentOptionsStore>()(
  persist(
    (set) => ({
      blurNsfwThumbnails: true,
      hideNsfwCommunities: true,
      hideDefaultCommunities: false,
      enableLocalNotifications: false,
      thumbnailDisplayOption: 'show',
      mediaPreviewOption: 'autoExpandAll',
      autoplayVideosOnComments: true,
      muteVideosOnComments: true,
      infiniteFeedEnabled: null,
      autoHideTopbar: null,
      setBlurNsfwThumbnails: (blur) => set({ blurNsfwThumbnails: blur }),
      setHideNsfwCommunities: (hide) => set({ hideNsfwCommunities: hide }),
      setHideDefaultCommunities: (hide) => set({ hideDefaultCommunities: hide }),
      setEnableLocalNotifications: (enable) => set({ enableLocalNotifications: enable }),
      setThumbnailDisplayOption: (option) => set({ thumbnailDisplayOption: option }),
      setMediaPreviewOption: (option) => set({ mediaPreviewOption: option }),
      setAutoplayVideosOnComments: (autoplay) => set({ autoplayVideosOnComments: autoplay }),
      setMuteVideosOnComments: (mute) => set({ muteVideosOnComments: mute }),
      setInfiniteFeedEnabled: (enabled) => set({ infiniteFeedEnabled: enabled }),
      setAutoHideTopbar: (enabled) => set({ autoHideTopbar: enabled }),
    }),
    {
      name: 'content-options',
      version: 1,
      migrate: (persistedState, version) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0) {
          // Collapse the retired per-tag booleans (adult/gore/anti/vulgar) into the single
          // NSFW toggle: stay hidden only if the user still had every tag hidden.
          state.hideNsfwCommunities =
            state.hideAdultCommunities !== false && state.hideGoreCommunities !== false && state.hideAntiCommunities !== false && state.hideVulgarCommunities !== false;
          delete state.hideAdultCommunities;
          delete state.hideGoreCommunities;
          delete state.hideAntiCommunities;
          delete state.hideVulgarCommunities;
        }
        return state as unknown as ContentOptionsStore;
      },
    },
  ),
);

export default useContentOptionsStore;
