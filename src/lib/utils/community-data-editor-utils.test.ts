import { describe, expect, it } from 'vitest';
import { removeSuggestedAvatarUrl } from './community-data-editor-utils';

describe('removeSuggestedAvatarUrl', () => {
  it('removes avatarUrl while preserving other suggested fields', () => {
    const suggested = {
      avatarUrl: 'https://example.com/avatar.png',
      bannerUrl: 'https://example.com/banner.png',
      nested: { color: 'blue' },
    };

    expect(removeSuggestedAvatarUrl(suggested)).toEqual({
      bannerUrl: 'https://example.com/banner.png',
      nested: { color: 'blue' },
    });
    expect(suggested.avatarUrl).toBe('https://example.com/avatar.png');
  });
});
