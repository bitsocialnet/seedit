import { describe, expect, it } from 'vitest';
import { isAuthorBannedForComment, isCommentLoadFailed, isCommentPublicationFailed } from './comment-utils';

describe('isAuthorBannedForComment', () => {
  it('reads the per-comment ban mark, including one left by a ban that ended', () => {
    expect(isAuthorBannedForComment({ authorBanExpiresAt: 1_900_000_000 })).toBe(true);
    expect(isAuthorBannedForComment({ authorBanExpiresAt: 1_000_000_000 })).toBe(true);
  });

  it('ignores a missing or non-positive mark, and the author-wide ban on every comment', () => {
    expect(isAuthorBannedForComment({})).toBe(false);
    expect(isAuthorBannedForComment({ authorBanExpiresAt: 0 })).toBe(false);
    expect(isAuthorBannedForComment({ author: { community: { banExpiresAt: 1_900_000_000 } } } as any)).toBe(false);
    expect(isAuthorBannedForComment(undefined)).toBe(false);
  });
});

describe('isCommentPublicationFailed', () => {
  it('treats a failed comment of the account, which carries its index, as a failed publication', () => {
    expect(isCommentPublicationFailed({ state: 'failed', index: 0 })).toBe(true);
    expect(isCommentPublicationFailed({ state: 'failed', index: 3 })).toBe(true);
  });

  it('does not treat a comment that failed to load as a failed publication', () => {
    expect(isCommentPublicationFailed({ state: 'failed' })).toBe(false);
    expect(isCommentPublicationFailed({ state: 'failed', index: undefined })).toBe(false);
  });

  it('ignores comments that did not fail', () => {
    expect(isCommentPublicationFailed({ state: 'pending', index: 0 })).toBe(false);
    expect(isCommentPublicationFailed({ state: 'succeeded', index: 0 })).toBe(false);
    expect(isCommentPublicationFailed(undefined)).toBe(false);
  });
});

describe('isCommentLoadFailed', () => {
  it('treats a failed comment without an account index as a failed load', () => {
    expect(isCommentLoadFailed({ state: 'failed' })).toBe(true);
    expect(isCommentLoadFailed({ state: 'failed', index: 1 })).toBe(false);
    expect(isCommentLoadFailed({ state: 'fetching-ipfs' })).toBe(false);
    expect(isCommentLoadFailed(undefined)).toBe(false);
  });
});
