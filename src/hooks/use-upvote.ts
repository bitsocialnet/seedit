import { useMemo } from 'react';
import { ChallengeVerification, Comment, usePublishVote, useAccountVote } from '@bitsocialnet/bitsocial-react-hooks';
import useChallengesStore from '../stores/use-challenges-store';
import { alertChallengeVerificationFailed } from '../lib/utils/challenge-utils';

const useUpvote = (comment: Comment): [boolean, () => void] => {
  const { addChallenge } = useChallengesStore();
  const { vote } = useAccountVote({ commentCid: comment?.cid });

  const publishVoteOptions = useMemo(
    () => ({
      commentCid: comment?.cid,
      vote: vote !== 1 ? 1 : 0,
      subplebbitAddress: comment?.subplebbitAddress,
      onChallenge: (...args: any) => {
        return new Promise<void>((resolve) => {
          addChallenge([...args, comment]);
          resolve();
        });
      },
      onChallengeVerification: (challengeVerification: ChallengeVerification, publication: any) =>
        new Promise<void>((resolve) => {
          alertChallengeVerificationFailed(challengeVerification, publication);
          resolve();
        }),
      onError: (error: Error) => {
        console.error(error);
        alert(error.message);
      },
    }),
    [comment, vote, addChallenge],
  );
  const { publishVote } = usePublishVote(publishVoteOptions);

  return [vote === 1, publishVote];
};

export default useUpvote;
