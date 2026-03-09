import { useMemo } from 'react';
import { ChallengeVerification, Comment, usePublishVote, useAccountVote } from '@bitsocialnet/bitsocial-react-hooks';
import { alertChallengeVerificationFailed } from '../lib/utils/challenge-utils';
import useChallengesStore from '../stores/use-challenges-store';

const useDownvote = (comment: Comment): [boolean, () => void] => {
  const { addChallenge } = useChallengesStore();
  const { vote } = useAccountVote({ commentCid: comment?.cid });

  const publishVoteOptions = useMemo(
    () => ({
      commentCid: comment?.cid,
      vote: vote !== -1 ? -1 : 0,
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

  return [vote === -1, publishVote];
};

export default useDownvote;
