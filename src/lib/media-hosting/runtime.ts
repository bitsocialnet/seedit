import { Capacitor } from '@capacitor/core';
import type { MediaHostingRuntime } from './types';

export function getMediaHostingRuntime(): MediaHostingRuntime {
  if (Capacitor.getPlatform() === 'android') return 'android';
  if (window.electronApi?.isElectron === true || window.isElectron === true) return 'electron';
  return 'web';
}
