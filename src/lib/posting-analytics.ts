import { trackPostingEvent, type PostingAnalyticsEvent, type PostingAnalyticsKind } from './analytics';

export type PostingAnalyticsContext = { kind: PostingAnalyticsKind };
type Verification = { challengeSuccess?: boolean; challengeErrors?: unknown; reason?: unknown };

const trackPostingSafely = (event: PostingAnalyticsEvent, context: PostingAnalyticsContext) => {
  try {
    trackPostingEvent(event, context);
  } catch {
    // Analytics must never interrupt composing or publishing.
  }
};

/**
 * One submitted attempt survives form unmounts (the submit page leaves for the pending page) without exposing an ID.
 * Only failures are sent. A submit or success event would reach the analytics host seconds before
 * the post appears in a public community, so its request logs could link the poster's IP to that post.
 */
export const startPostingAnalytics = (context: PostingAnalyticsContext) => {
  let finished = false;
  let hadChallenge = false;
  const finish = (event: PostingAnalyticsEvent) => {
    if (finished) return;
    finished = true;
    trackPostingSafely(event, context);
  };
  return {
    finish,
    challenge: () => {
      hadChallenge = true;
    },
    verify: (verification: Verification) => {
      if (verification.challengeSuccess === true) {
        // Accepted: close the attempt silently so a late callback cannot report a failure.
        finished = true;
        return;
      }
      const errors = verification.challengeErrors;
      const hasErrors = errors && typeof errors === 'object' ? Object.keys(errors).length > 0 : Boolean(errors);
      // Hooks retries a wrong challenge answer. A reason/errors or rejection without a challenge is terminal.
      if (!hadChallenge || hasErrors || verification.reason) finish('post_challenge_failed');
      hadChallenge = false;
    },
  };
};

export type PostingAnalyticsAttempt = ReturnType<typeof startPostingAnalytics>;
