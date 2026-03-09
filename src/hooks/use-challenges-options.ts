import { usePlebbitRpcSettings } from '@bitsocialnet/bitsocial-react-hooks';

const useChallengesOptions = () => {
  const { challenges } = usePlebbitRpcSettings().plebbitRpcSettings || {};

  const options = Object.keys(challenges || {}).reduce(
    (acc, challengeName) => {
      const challengeSettings = challenges[challengeName];
      acc[challengeName] = challengeSettings.optionInputs.reduce((optionsAcc: any, input: any) => {
        optionsAcc[input.option] = input.default || '';
        return optionsAcc;
      }, {});
      return acc;
    },
    {} as Record<string, Record<string, string>>,
  );

  return options;
};

export default useChallengesOptions;
