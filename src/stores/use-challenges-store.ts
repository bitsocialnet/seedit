import { create } from 'zustand';
import { Challenge } from '@bitsocial/bitsocial-react-hooks';

export interface ChallengeEntry {
  challenge: Challenge;
  id: number;
  onAbandon?: () => Promise<void> | void;
  stopWatchingPublication: () => void;
}

let nextChallengeId = 0;

type PublicationEvents = {
  on?: (event: 'statechange', listener: (state: string) => void) => unknown;
  removeListener?: (event: 'statechange', listener: (state: string) => void) => unknown;
};

// pkc-js sets a publication's state to "stopped" when its challenge exchange is over: a verdict (also the failed one a
// community sends when it stops waiting for an answer), a failure (no response, the RPC server failed the publish) or
// stop(). An error it recovers from, such as a challenge it cannot decrypt, leaves the state "publishing"
// (publishingState alone can read "failed" then), so only the state ends a challenge still waiting for its answer.
const watchExchangeEnd = (publication: PublicationEvents | undefined, onEnd: () => void) => {
  if (typeof publication?.on !== 'function' || typeof publication.removeListener !== 'function') return () => {};
  const onStateChange = (state: string) => {
    if (state === 'stopped') onEnd();
  };
  publication.on('statechange', onStateChange);
  return () => {
    publication.removeListener?.('statechange', onStateChange);
  };
};

interface State {
  challenges: ChallengeEntry[];
  addChallenge: (challenge: Challenge, onAbandon?: () => Promise<void> | void) => void;
  removeChallenge: () => void;
  abandonCurrentChallenge: () => Promise<void>;
}

const useChallengesStore = create<State>((set, get) => {
  const removeChallengeEntry = (id: number) => {
    get()
      .challenges.find((entry) => entry.id === id)
      ?.stopWatchingPublication();
    set((state) => ({ challenges: state.challenges.filter((entry) => entry.id !== id) }));
  };

  return {
    challenges: [],
    addChallenge: (challenge, onAbandon) => {
      const id = nextChallengeId++;
      // an ended exchange takes its challenge out of the queue (and the modal); the publication already reported how
      // it ended through its verification or error callbacks
      const stopWatchingPublication = watchExchangeEnd(challenge?.[1], () => removeChallengeEntry(id));
      set((state) => ({ challenges: [...state.challenges, { challenge, id, onAbandon, stopWatchingPublication }] }));
    },
    removeChallenge: () => {
      const currentChallenge = get().challenges[0];
      if (currentChallenge) removeChallengeEntry(currentChallenge.id);
    },
    abandonCurrentChallenge: async () => {
      const currentChallenge = get().challenges[0];
      get().removeChallenge();

      try {
        if (currentChallenge?.onAbandon) {
          await currentChallenge.onAbandon();
        } else if (typeof currentChallenge?.challenge?.[1]?.stop === 'function') {
          await currentChallenge.challenge[1].stop();
        }
      } catch (error) {
        console.error('Failed to abandon challenge publication:', error);
      }
    },
  };
});

export default useChallengesStore;
