import { type Comment, type PublishCommentEditOptions, useComment, useEditedComment, usePublishCommentEdit } from '@bitsocial/bitsocial-react-hooks';
import { alertChallengeVerificationFailed } from '../lib/utils/challenge-utils';
import { getCommentCommunityAddress } from '../lib/utils/comment-utils';
import challengesStore from '../stores/use-challenges-store';

const { addChallenge } = challengesStore.getState();

/** An author deleting or undeleting their own comment; both interfaces' menus use it. */
const useDeleteComment = (commentCid: string) => {
  const comment = useComment({ commentCid });
  const { editedComment } = useEditedComment({ comment });
  const post: Comment | undefined = editedComment || comment;
  const deleted: boolean | undefined = post?.deleted;

  // this only toggles deleted, and usePublishCommentEdit publishes the options of the render that returned it, so
  // the toggle can publish the flipped value directly
  const publishOptions: PublishCommentEditOptions = {
    commentCid,
    deleted: !deleted,
    communityAddress: getCommentCommunityAddress(post),
    onChallenge: (...args: any) => addChallenge([...args, post]),
    onChallengeVerification: alertChallengeVerificationFailed,
    onError: (error: Error) => {
      console.warn(error);
      alert('Comment edit failed. ' + error.message);
    },
  };
  const { publishCommentEdit } = usePublishCommentEdit(publishOptions);

  return { deleted, toggleDeleted: () => void publishCommentEdit() };
};

export default useDeleteComment;
