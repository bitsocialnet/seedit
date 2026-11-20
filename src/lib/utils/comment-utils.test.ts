import { describe, expect, it } from 'vitest';
import { isCommentPublicationFailed } from './comment-utils';

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
