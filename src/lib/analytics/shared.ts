type AnalyticsWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean } };

// Only production builds served over https on seedit.app. The desktop app (Electron), the Android
// app (Capacitor, served from https://localhost), the IPFS/ENS mirrors and dev builds never send anything.
export const isAnalyticsEnabled = (): boolean => {
  if (!import.meta.env.PROD || typeof window === 'undefined') return false;
  const { location, isElectron, electronApi, Capacitor } = window as AnalyticsWindow;
  return (
    !isElectron &&
    !electronApi?.isElectron &&
    Capacitor?.isNativePlatform?.() !== true &&
    location.protocol === 'https:' &&
    (location.hostname === 'seedit.app' || location.hostname === 'www.seedit.app')
  );
};

// Failure outcomes only: see startPostingAnalytics for why submits and successes are never sent.
export type PostingAnalyticsEvent = 'post_validation_failed' | 'post_upload_failed' | 'post_challenge_failed' | 'post_publish_failed' | 'post_cancelled';

export type PostingAnalyticsKind = 'post' | 'reply';
