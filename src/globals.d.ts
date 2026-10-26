import type { ProviderId } from './lib/media-hosting';
import type { LocalNotification } from './lib/push/common';

declare global {
  interface Window {
    isElectron: boolean;
    BITSOCIAL_REACT_HOOKS_ACCOUNTS_STORE_INITIALIZING?: boolean;
    defaultPkcOptions?: Record<string, unknown>;
    // Set by src/static-shell.tsx while index.html's static first frame is rendered at build time.
    STATIC_SHELL_RENDER?: boolean;
  }
}

declare global {
  interface Window {
    electronApi?: {
      isElectron: boolean;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      getNotificationStatus: () => Promise<'granted' | 'denied' | 'not-determined' | 'not-supported'>;
      getPlatform: () => Promise<NodeJS.Platform>;
      getNodeReachability?: () => Promise<'public' | 'private' | 'unknown'>;
      testNotification: () => Promise<{ success: boolean; reason?: string }>;
      showNotification: (notification: Omit<LocalNotification, 'id'>) => void;
      /** Uploads a file the user picked or dropped, by its path on disk, which the preload resolves itself. */
      automateUploadMedia?: (options: { provider: ProviderId; file: File }) => Promise<{ url: string; provider: ProviderId }>;
      automateUploadGeneratedMedia?: (options: {
        provider: ProviderId;
        fileName: string;
        mimeType: string;
        bytes: number[];
      }) => Promise<{ url: string; provider: ProviderId }>;
      getForgeTurnstileToken?: (sitekey: string) => Promise<string>;
      /** Whether the file is backed by a file on disk (picked or dropped), so automateUploadMedia can take it. */
      isFileOnDisk?: (file: File) => boolean;
    };
  }
}

export {};
