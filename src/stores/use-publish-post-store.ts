import { create } from 'zustand';
import { Comment, Crosspost, PublishCommentOptions } from '@bitsocial/bitsocial-react-hooks';
import { alertChallengeVerificationFailed } from '../lib/utils/challenge-utils';
import { getCommentCommunityAddress } from '../lib/utils/comment-utils';

type SubmitState = {
  communityAddress: string | undefined;
  title: string | undefined;
  content: string | undefined;
  link: string | undefined;
  spoiler: boolean | undefined;
  nsfw: boolean | undefined;
  crosspost: Crosspost | undefined;
  publishCommentOptions: PublishCommentOptions;
  /** True while the upload form waits for the media upload that fills in the link. Not part of the draft, so a reset keeps it. */
  isUploadingMedia: boolean;
  setPublishPostStore: (comment: Comment) => void;
  setIsUploadingMedia: (isUploadingMedia: boolean) => void;
  resetPublishPostStore: () => void;
};

const usePublishPostStore = create<SubmitState>((set) => ({
  communityAddress: undefined,
  title: undefined,
  content: undefined,
  link: undefined,
  spoiler: undefined,
  nsfw: undefined,
  crosspost: undefined,
  publishCommentOptions: {},
  isUploadingMedia: false,
  setPublishPostStore: (comment) =>
    set((state) => {
      const nextState = { ...state };
      const commentCommunityAddress = getCommentCommunityAddress(comment);
      const { title, content, link, spoiler, nsfw, crosspost } = comment;

      if (commentCommunityAddress !== undefined) nextState.communityAddress = commentCommunityAddress;
      if (title !== undefined) nextState.title = title;
      if (content !== undefined) nextState.content = content || undefined;
      if (link !== undefined) nextState.link = link || undefined;
      if (spoiler !== undefined) nextState.spoiler = spoiler || undefined;
      if (nsfw !== undefined) nextState.nsfw = nsfw || undefined;
      if ('crosspost' in comment) nextState.crosspost = crosspost;

      nextState.publishCommentOptions = {
        communityAddress: nextState.communityAddress,
        title: nextState.title,
        content: nextState.content,
        link: nextState.link,
        spoiler: nextState.spoiler,
        nsfw: nextState.nsfw,
        crosspost: nextState.crosspost,
        onChallengeVerification: alertChallengeVerificationFailed,
        onError: (error: Error) => {
          console.error(error);
          alert(error.message);
        },
      };

      return nextState;
    }),
  setIsUploadingMedia: (isUploadingMedia) => set({ isUploadingMedia }),
  resetPublishPostStore: () =>
    set({
      communityAddress: undefined,
      title: undefined,
      content: undefined,
      link: undefined,
      spoiler: undefined,
      nsfw: undefined,
      crosspost: undefined,
      publishCommentOptions: {},
    }),
}));

export default usePublishPostStore;
