import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ChallengeVerification, Comment, PublishCommentOptions, usePublishComment } from '@bitsocial/bitsocial-react-hooks';
import type { PostingAnalyticsAttempt } from '../lib/posting-analytics';
import useChallengesStore from '../stores/use-challenges-store';

// A publication keeps the callbacks of the options object it started with, even after its form
// unmounts or starts another publication, so its analytics attempt is looked up by that object.
const publicationAttempts = new WeakMap<object, PostingAnalyticsAttempt>();

/** onAbandon runs after the pending comment is discarded, so the caller can restore what it published. */
const usePublishCommentWithChallengeAbandon = (publishCommentOptions: PublishCommentOptions, onAbandon?: () => void) => {
  const addChallenge = useChallengesStore((state) => state.addChallenge);
  const abandonPublishRef = useRef<(() => Promise<void>) | undefined>(undefined);
  // usePublishComment abandons only the form's latest publication, so an older one is stopped on its own
  const latestPublishedOptionsRef = useRef<PublishCommentOptions | undefined>(undefined);
  const abandonCurrentPublish = useCallback(async () => {
    await abandonPublishRef.current?.();
    onAbandon?.();
  }, [onAbandon]);

  const publishOptionsWithAbandon = useMemo(() => {
    const options: PublishCommentOptions = {
      ...publishCommentOptions,
      onChallenge: async (...args: any[]) => {
        publicationAttempts.get(options)?.challenge();
        addChallenge(args, async () => {
          publicationAttempts.get(options)?.finish('post_cancelled');
          if (latestPublishedOptionsRef.current && latestPublishedOptionsRef.current !== options) {
            await args[1]?.stop?.();
            return;
          }
          await abandonCurrentPublish();
        });
      },
      onChallengeVerification: (challengeVerification: ChallengeVerification, comment: Comment) => {
        publicationAttempts.get(options)?.verify(challengeVerification);
        return publishCommentOptions?.onChallengeVerification?.(challengeVerification, comment);
      },
      onError: (error: Error) => {
        publicationAttempts.get(options)?.finish('post_publish_failed');
        return publishCommentOptions?.onError?.(error);
      },
    };
    return options;
  }, [abandonCurrentPublish, addChallenge, publishCommentOptions]);

  const publishResult = usePublishComment(publishOptionsWithAbandon);
  useEffect(() => {
    abandonPublishRef.current = publishResult.abandonPublish;
  }, [publishResult.abandonPublish]);

  const { publishComment: publish } = publishResult;
  // usePublishComment publishes with the options of the render that returned it, which are these.
  const publishComment = useCallback(
    (attempt?: PostingAnalyticsAttempt) => {
      latestPublishedOptionsRef.current = publishOptionsWithAbandon;
      if (attempt) publicationAttempts.set(publishOptionsWithAbandon, attempt);
      else publicationAttempts.delete(publishOptionsWithAbandon);
      return publish();
    },
    [publish, publishOptionsWithAbandon],
  );

  return { ...publishResult, publishComment };
};

export default usePublishCommentWithChallengeAbandon;
