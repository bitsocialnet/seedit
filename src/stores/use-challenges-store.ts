import { create } from 'zustand';
import { Challenge } from '@bitsocialnet/bitsocial-react-hooks';

interface State {
  challenges: Challenge[];
  addChallenge: (challenge: Challenge) => void;
  removeChallenge: () => void;
}

const useChallengesStore = create<State>((set) => ({
  challenges: [],
  addChallenge: (challenge: Challenge) => {
    set((state) => ({ challenges: [...state.challenges, challenge] }));
  },
  removeChallenge: () => {
    set((state) => {
      const challenges = [...state.challenges];
      challenges.shift();
      return { challenges };
    });
  },
}));

export default useChallengesStore;
