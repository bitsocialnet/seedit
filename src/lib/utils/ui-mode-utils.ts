export type UiMode = 'modern' | 'old';

// New visitors, and anyone who never picked an interface, get this one.
export const DEFAULT_UI_MODE: UiMode = 'modern';
export const UI_MODE_STORAGE_KEY = 'uiMode';
// `?ui=old` (before the hash) switches the interface once and is then removed from the address.
// old.seedit.app redirects to seedit.app/?ui=old, so both interfaces share one origin and its account storage.
export const UI_MODE_QUERY_PARAM = 'ui';

export const isUiMode = (value: unknown): value is UiMode => value === 'modern' || value === 'old';

export const getUiModeFromSearch = (search: string): UiMode | undefined => {
  const value = new URLSearchParams(search).get(UI_MODE_QUERY_PARAM);
  return isUiMode(value) ? value : undefined;
};

export const getSearchWithoutUiMode = (search: string): string => {
  const params = new URLSearchParams(search);
  params.delete(UI_MODE_QUERY_PARAM);
  const remaining = params.toString();
  return remaining ? `?${remaining}` : '';
};
