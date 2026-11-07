import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startPostingAnalytics } from './posting-analytics';

const track = vi.hoisted(() => vi.fn());
vi.mock('./analytics', () => ({ trackPostingEvent: track }));

describe('posting analytics attempts', () => {
  beforeEach(() => {
    track.mockReset();
  });

  it('sends nothing for an accepted post, even when callbacks repeat after unmount', () => {
    const attempt = startPostingAnalytics({ kind: 'post' });
    attempt.verify({ challengeSuccess: true });
    attempt.verify({ challengeSuccess: true });
    attempt.finish('post_cancelled');
    attempt.finish('post_publish_failed');
    expect(track).not.toHaveBeenCalled();
  });

  it('allows a wrong challenge answer to retry before success without sending anything', () => {
    const attempt = startPostingAnalytics({ kind: 'reply' });
    attempt.challenge();
    attempt.verify({ challengeSuccess: false });
    attempt.challenge();
    attempt.verify({ challengeSuccess: true });
    expect(track).not.toHaveBeenCalled();
  });

  it('records terminal rejection once without forwarding rejection details', () => {
    const attempt = startPostingAnalytics({ kind: 'reply' });
    attempt.challenge();
    attempt.verify({ challengeSuccess: false, reason: 'private rejected text', challengeErrors: { 0: 'private rejected URL' } });
    attempt.finish('post_cancelled');
    expect(track.mock.calls).toEqual([['post_challenge_failed', { kind: 'reply' }]]);
  });

  it('treats a rejection without a challenge as terminal', () => {
    const attempt = startPostingAnalytics({ kind: 'post' });
    attempt.verify({ challengeSuccess: false });
    expect(track.mock.calls).toEqual([['post_challenge_failed', { kind: 'post' }]]);
  });

  it('keeps independent retries separate and cannot throw into posting', () => {
    track.mockImplementation(() => {
      throw new Error('analytics unavailable');
    });
    expect(() => {
      const first = startPostingAnalytics({ kind: 'post' });
      first.finish('post_upload_failed');
      const retry = startPostingAnalytics({ kind: 'post' });
      retry.finish('post_upload_failed');
    }).not.toThrow();
    expect(track).toHaveBeenCalledTimes(2);
  });
});
