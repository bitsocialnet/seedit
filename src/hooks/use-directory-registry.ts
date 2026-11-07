import { useSyncExternalStore } from 'react';
import { getDirectoryRegistrySnapshot, subscribeToDirectoryRegistry, type DirectoryRegistrySnapshot } from '../lib/utils/directory-registry';

/** The directory codes and metadata this client knows, refreshed from bitsocialnet/lists at most hourly. */
export const useDirectoryRegistry = (): DirectoryRegistrySnapshot =>
  useSyncExternalStore(subscribeToDirectoryRegistry, getDirectoryRegistrySnapshot, getDirectoryRegistrySnapshot);
