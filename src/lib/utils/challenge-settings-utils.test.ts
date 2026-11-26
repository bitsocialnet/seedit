import { describe, expect, it } from 'vitest';
import { getExcludeAddresses, setExcludeAddresses, setExcludeNumber, toggleExcludePublicationType, toggleExcludeRole } from './challenge-settings-utils';

describe('challenge exclude edits', () => {
  it('splits addresses into names and public keys the way pkc-js does, dropping empty lists', () => {
    const exclude = setExcludeAddresses({ rateLimit: 2 }, ' alice.bso, 12D3KooWKey ,, bob.eth');
    expect(exclude).toEqual({ rateLimit: 2, names: ['alice.bso', 'bob.eth'], publicKeys: ['12D3KooWKey'] });
    expect(getExcludeAddresses(exclude)).toEqual(['alice.bso', 'bob.eth', '12D3KooWKey']);
    expect(setExcludeAddresses(exclude, 'carol.bso')).toEqual({ rateLimit: 2, names: ['carol.bso'] });
    expect(setExcludeAddresses(exclude, '')).toEqual({ rateLimit: 2 });
  });

  it('writes roles, never the removed role field, and removes the list once empty', () => {
    const withModerator = toggleExcludeRole({}, 'moderator');
    expect(withModerator).toEqual({ roles: ['moderator'] });
    expect(toggleExcludeRole(withModerator, 'admin')).toEqual({ roles: ['moderator', 'admin'] });
    expect(toggleExcludeRole(withModerator, 'moderator')).toEqual({});
  });

  it('keeps publication types under publicationType as true values, and removes the object once empty', () => {
    const posts = toggleExcludePublicationType({}, 'post');
    expect(posts).toEqual({ publicationType: { post: true } });
    expect(toggleExcludePublicationType(posts, 'reply')).toEqual({ publicationType: { post: true, reply: true } });
    expect(toggleExcludePublicationType(posts, 'post')).toEqual({});
  });

  it('removes a number field that is cleared', () => {
    expect(setExcludeNumber({ postScore: 5, replyScore: 1 }, 'postScore', undefined)).toEqual({ replyScore: 1 });
    expect(setExcludeNumber({}, 'rateLimit', 0)).toEqual({ rateLimit: 0 });
  });
});
