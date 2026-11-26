import { usePkcRpcSettings } from '@bitsocial/bitsocial-react-hooks';

/** Each challenge the node offers, mapped to its options' default values. */
const useChallengesOptions = () => {
  const challenges = usePkcRpcSettings().pkcRpcSettings?.challenges;

  return Object.fromEntries(
    Object.entries(challenges ?? {}).map(([challengeName, challengeSettings]) => [
      challengeName,
      Object.fromEntries((challengeSettings.optionInputs ?? []).map((input: any) => [input.option, input.default || ''])),
    ]),
  ) as Record<string, Record<string, string>>;
};

export default useChallengesOptions;
