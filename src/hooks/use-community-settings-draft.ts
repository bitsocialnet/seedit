import type { Role } from '@bitsocial/bitsocial-react-hooks';
import { DEFAULT_CHALLENGE_NAME, removeChallengeAt, type ChallengeExclude, type ChallengeSetting } from '../lib/utils/challenge-settings-utils';
import type { Roles } from '../lib/utils/user-utils';
import useCommunitySettingsStore from '../stores/use-community-settings-store';
import useChallengesOptions from './use-challenges-options';

// Each hook reads one field of the community settings draft, so editing one field leaves the others' editors alone.

/** The rules in the community settings draft, and edits to them. */
export const useCommunityRulesDraft = () => {
  const rules = useCommunitySettingsStore((state) => state.rules);
  const setDraft = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);
  const current = rules ?? [];

  return {
    rules,
    addRule: () => setDraft({ rules: [...current, ''] }),
    setRule: (index: number, rule: string) => setDraft({ rules: current.map((currentRule, ruleIndex) => (ruleIndex === index ? rule : currentRule)) }),
    removeRule: (index: number) => setDraft({ rules: current.filter((_, ruleIndex) => ruleIndex !== index) }),
  };
};

/** The moderators in the community settings draft, keyed by author address, and edits to them. */
export const useCommunityModeratorsDraft = () => {
  const roles = useCommunitySettingsStore((state) => state.roles);
  const setDraft = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);

  return {
    roles,
    // a new moderator starts with an empty address until one is typed
    addModerator: () => setDraft({ roles: { ...roles, '': { role: 'moderator' } } }),
    /** Renames the moderator at a position, keeping the order the list shows. */
    setModeratorAddress: (index: number, address: string) => {
      const entries = Object.entries(roles ?? {});
      if (!entries[index]) return;
      entries[index] = [address, entries[index][1]];
      setDraft({ roles: Object.fromEntries(entries) as Roles });
    },
    setModeratorRole: (address: string, role: Role['role']) => setDraft({ roles: { ...roles, [address]: { role } } }),
    removeModerator: (address: string) => {
      const { [address]: _removed, ...rest } = roles ?? {};
      setDraft({ roles: rest });
    },
  };
};

/**
 * The challenges in the community settings draft and edits to them. Without readable settings, the community's
 * published challenges are shown instead.
 */
export const useCommunityChallengesDraft = (publishedChallenges?: ChallengeSetting[]) => {
  const settings = useCommunitySettingsStore((state) => state.settings);
  const setDraft = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);
  const challengeOptions = useChallengesOptions();
  const challenges: ChallengeSetting[] = settings?.challenges || publishedChallenges || [];

  const updateChallenges = (update: (challenges: ChallengeSetting[]) => ChallengeSetting[]) =>
    setDraft({ settings: { ...settings, challenges: update(settings?.challenges ?? []) } });
  const updateChallenge = (index: number, update: (challenge: ChallengeSetting) => ChallengeSetting) =>
    updateChallenges((current) => current.map((challenge, challengeIndex) => (challengeIndex === index ? update(challenge) : challenge)));
  const updateExcludeGroups = (index: number, update: (exclude: ChallengeExclude[]) => ChallengeExclude[]) =>
    updateChallenge(index, (challenge) => ({ ...challenge, exclude: update(challenge.exclude ?? []) }));

  return {
    challenges,
    addChallenge: () => updateChallenges((current) => [...current, { name: DEFAULT_CHALLENGE_NAME, options: challengeOptions[DEFAULT_CHALLENGE_NAME] || {} }]),
    removeChallenge: (index: number) => updateChallenges((current) => removeChallengeAt(current, index)),
    /** Switches a challenge to another one, starting from that challenge's default options. */
    setChallengeName: (index: number, name: string) => updateChallenge(index, (challenge) => ({ ...challenge, name, options: challengeOptions[name] || {} })),
    setChallengeOption: (index: number, option: string, value: string) =>
      updateChallenge(index, (challenge) => ({ ...challenge, options: { ...challenge.options, [option]: value } })),
    addExcludeGroup: (index: number) => updateExcludeGroups(index, (groups) => [...groups, {}]),
    removeExcludeGroup: (index: number, groupIndex: number) => updateExcludeGroups(index, (groups) => groups.filter((_, currentIndex) => currentIndex !== groupIndex)),
    /** Applies an edit from challenge-settings-utils to one exclude group. */
    updateExcludeGroup: (index: number, groupIndex: number, update: (exclude: ChallengeExclude) => ChallengeExclude) =>
      updateExcludeGroups(index, (groups) => groups.map((group, currentIndex) => (currentIndex === groupIndex ? update(group) : group))),
  };
};
