import { PublishSubplebbitEditOptions } from '@bitsocialnet/bitsocial-react-hooks';
import { Roles } from '../lib/utils/user-utils';
import { create } from 'zustand';

export type SubplebbitSettingsState = {
  challenges: any[] | undefined;
  title: string | undefined;
  description: string | undefined;
  address: string | undefined;
  suggested: any | undefined;
  rules: string[] | undefined;
  roles: Roles | undefined;
  settings: any | undefined;
  subplebbitAddress: string | undefined;
  publishSubplebbitEditOptions: PublishSubplebbitEditOptions;
  setSubplebbitSettingsStore: (data: Partial<SubplebbitSettingsState>) => void;
  resetSubplebbitSettingsStore: () => void;
};

const useSubplebbitSettingsStore = create<SubplebbitSettingsState>((set) => ({
  challenges: undefined,
  title: undefined,
  description: undefined,
  address: undefined,
  suggested: undefined,
  rules: undefined,
  roles: undefined,
  settings: undefined,
  subplebbitAddress: undefined,
  publishSubplebbitEditOptions: {},
  setSubplebbitSettingsStore: (props) =>
    set((state) => {
      const nextState = { ...state };
      Object.entries(props).forEach(([key, value]) => {
        if (value !== undefined) {
          (nextState as any)[key] = value;
        }
      });
      const editOptions: Partial<SubplebbitSettingsState> = {};
      if (nextState.title !== undefined) editOptions.title = nextState.title?.trim() === '' ? undefined : nextState.title;
      if (nextState.description !== undefined) editOptions.description = nextState.description?.trim() === '' ? undefined : nextState.description;
      if (nextState.address !== undefined) editOptions.address = nextState.address?.trim() === '' ? undefined : nextState.address;
      if (nextState.suggested !== undefined) editOptions.suggested = nextState.suggested;
      if (nextState.rules !== undefined) editOptions.rules = nextState.rules;
      if (nextState.roles !== undefined) editOptions.roles = nextState.roles;
      if (nextState.settings !== undefined) editOptions.settings = nextState.settings;
      if (nextState.subplebbitAddress !== undefined) editOptions.subplebbitAddress = nextState.subplebbitAddress?.trim() === '' ? undefined : nextState.subplebbitAddress;
      nextState.publishSubplebbitEditOptions = editOptions;
      return nextState;
    }),
  resetSubplebbitSettingsStore: () =>
    set(() => {
      return {
        challenges: undefined,
        title: undefined,
        description: undefined,
        address: undefined,
        suggested: undefined,
        rules: undefined,
        roles: undefined,
        settings: undefined,
        subplebbitAddress: undefined,
        publishSubplebbitEditOptions: {},
      };
    }),
}));

export default useSubplebbitSettingsStore;
