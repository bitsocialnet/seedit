import { useMemo, useRef } from 'react';
import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import type { PostingAnalyticsAttempt } from '../lib/posting-analytics';
import usePublishReplyStore from '../stores/use-publish-reply-store';
import usePublishCommentWithChallengeAbandon from './use-publish-comment-with-challenge-abandon';

const usePublishReply = ({ cid, communityAddress, postCid }: { cid: string; communityAddress: string; postCid: string | undefined }) => {
  const parentCid = cid;
  const { content, link, spoiler, nsfw, publishCommentOptions, publishReplyOptions } = usePublishReplyStore((state) => ({
    content: state.content[parentCid],
    link: state.link[parentCid],
    spoiler: state.spoiler[parentCid],
    nsfw: state.nsfw[parentCid],
    publishCommentOptions: state.publishCommentOptions[parentCid],
    publishReplyOptions: state.publishReplyOptions[parentCid],
  }));

  const setReplyStore = usePublishReplyStore((state) => state.setReplyStore);
  const resetReplyStore = usePublishReplyStore((state) => state.resetReplyStore);

  const publishedDraftRef = useRef<Comment | undefined>(undefined);
  const restorePublishedDraft = () => {
    const publishedDraft = publishedDraftRef.current;
    publishedDraftRef.current = undefined;
    if (publishedDraft) {
      setReplyStore(publishedDraft);
    }
  };

  const setPublishReplyOptions = useMemo(
    () => ({
      content: (newContent: string) =>
        setReplyStore({
          communityAddress,
          parentCid,
          postCid: postCid ?? parentCid,
          content: newContent === '' ? undefined : newContent,
          link: link || undefined,
          spoiler: spoiler || false,
          nsfw: nsfw || false,
        }),
      link: (newLink: string) =>
        setReplyStore({
          communityAddress,
          parentCid,
          postCid: postCid ?? parentCid,
          content: content,
          link: newLink || undefined,
          spoiler: spoiler || false,
          nsfw: nsfw || false,
        }),
      spoiler: (newSpoiler: boolean) =>
        setReplyStore({
          communityAddress,
          parentCid,
          postCid: postCid ?? parentCid,
          content: content,
          link: link || undefined,
          spoiler: newSpoiler,
          nsfw: nsfw || false,
        }),
      nsfw: (newNsfw: boolean) =>
        setReplyStore({
          communityAddress,
          parentCid,
          postCid: postCid ?? parentCid,
          content: content,
          link: link || undefined,
          spoiler: spoiler || false,
          nsfw: newNsfw,
        }),
    }),
    [communityAddress, parentCid, setReplyStore, content, link, spoiler, nsfw, postCid],
  );

  const resetPublishReplyOptions = useMemo(() => () => resetReplyStore(parentCid), [parentCid, resetReplyStore]);

  const { index, publishComment } = usePublishCommentWithChallengeAbandon(publishCommentOptions, restorePublishedDraft);
  const publishReply = (attempt?: PostingAnalyticsAttempt) => {
    publishedDraftRef.current = publishReplyOptions as Comment;
    publishComment(attempt);
  };

  return { setPublishReplyOptions, resetPublishReplyOptions, replyIndex: index, publishReply, publishReplyOptions };
};

export default usePublishReply;
