import { PublishCommentOptions } from '@bitsocialnet/bitsocial-react-hooks';
import { ChallengeVerification, Comment } from '@bitsocialnet/bitsocial-react-hooks';
import { create } from 'zustand';
import useChallengesStore from './use-challenges-store';
import { alertChallengeVerificationFailed } from '../lib/utils/challenge-utils';

type ReplyState = {
  content: { [parentCid: string]: string | undefined };
  link: { [parentCid: string]: string | undefined };
  spoiler: { [parentCid: string]: boolean | undefined };
  nsfw: { [parentCid: string]: boolean | undefined };
  publishCommentOptions: PublishCommentOptions;
  publishReplyOptions: PublishCommentOptions;
  setReplyStore: (comment: Comment) => void;
  resetReplyStore: (parentCid: string) => void;
};

const { addChallenge } = useChallengesStore.getState();

const usePublishReplyStore = create<ReplyState>((set) => ({
  content: {},
  link: {},
  spoiler: {},
  nsfw: {},
  publishCommentOptions: {},
  publishReplyOptions: {},
  setReplyStore: (comment: Comment) =>
    set((state) => {
      const { subplebbitAddress, parentCid, content, link, spoiler, nsfw } = comment;
      const publishCommentOptions = {
        subplebbitAddress,
        parentCid,
        postCid: comment?.postCid || parentCid,
        content,
        link,
        spoiler,
        nsfw,
        onChallenge: (...args: any) => addChallenge(args),
        onChallengeVerification: (challengeVerification: ChallengeVerification, comment: Comment) => {
          alertChallengeVerificationFailed(challengeVerification, comment);
        },
        onError: (error: Error) => {
          console.error(error);
          alert(error.message);
        },
      };
      return {
        content: { ...state.content, [parentCid]: content },
        link: { ...state.link, [parentCid]: link },
        spoiler: { ...state.spoiler, [parentCid]: spoiler },
        nsfw: { ...state.nsfw, [parentCid]: nsfw },
        publishCommentOptions: { ...state.publishCommentOptions, [parentCid]: publishCommentOptions },
        publishReplyOptions: { ...state.publishReplyOptions, [parentCid]: publishCommentOptions },
      };
    }),

  resetReplyStore: (parentCid) =>
    set((state) => ({
      content: { ...state.content, [parentCid]: undefined },
      link: { ...state.link, [parentCid]: undefined },
      spoiler: { ...state.spoiler, [parentCid]: undefined },
      nsfw: { ...state.nsfw, [parentCid]: undefined },
      publishCommentOptions: { ...state.publishCommentOptions, [parentCid]: undefined },
      publishReplyOptions: { ...state.publishReplyOptions, [parentCid]: undefined },
    })),
}));

export default usePublishReplyStore;
