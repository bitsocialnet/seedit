import { describe, expect, it } from 'vitest';
import { getSearchWithoutUiMode, getUiModeFromSearch } from './ui-mode-utils';

describe('ui mode query', () => {
  it('reads a valid ui mode and ignores anything else', () => {
    expect(getUiModeFromSearch('?ui=old')).toBe('old');
    expect(getUiModeFromSearch('?lng=de&ui=modern')).toBe('modern');
    expect(getUiModeFromSearch('?ui=classic')).toBeUndefined();
    expect(getUiModeFromSearch('')).toBeUndefined();
  });

  it('removes only the ui parameter', () => {
    expect(getSearchWithoutUiMode('?ui=old')).toBe('');
    expect(getSearchWithoutUiMode('?lng=de&ui=old')).toBe('?lng=de');
    expect(getSearchWithoutUiMode('')).toBe('');
  });
});
