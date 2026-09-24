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
      testNotification: () => Promise<{ success: boolean; reason?: string }>;
    };
  }
}

export {};
