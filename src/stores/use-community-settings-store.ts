import { PublishCommunityEditOptions } from '@bitsocial/bitsocial-react-hooks';
import { Roles } from '../lib/utils/user-utils';
import { create } from 'zustand';

export type CommunitySettingsState = {
  challenges: any[] | undefined;
  title: string | undefined;
  description: string | undefined;
  address: string | undefined;
  suggested: any | undefined;
  rules: string[] | undefined;
  roles: Roles | undefined;
  settings: any | undefined;
  communityAddress: string | undefined;
  // true once the create view initialized the draft, so leaving and reopening it keeps the draft
  isCreateDraft: boolean;
  publishCommunityEditOptions: PublishCommunityEditOptions;
  setCommunitySettingsStore: (data: Partial<CommunitySettingsState>) => void;
  resetCommunitySettingsStore: () => void;
};

const useCommunitySettingsStore = create<CommunitySettingsState>((set) => ({
  challenges: undefined,
  title: undefined,
  description: undefined,
  address: undefined,
  suggested: undefined,
  rules: undefined,
  roles: undefined,
  settings: undefined,
  communityAddress: undefined,
  isCreateDraft: false,
  publishCommunityEditOptions: {},
  setCommunitySettingsStore: (props) =>
    set((state) => {
      const nextState = { ...state };
      Object.entries(props).forEach(([key, value]) => {
        if (value !== undefined) {
          (nextState as any)[key] = value;
        }
      });
      const editOptions: Partial<CommunitySettingsState> = {};
      if (nextState.title !== undefined) editOptions.title = nextState.title?.trim() === '' ? undefined : nextState.title;
      if (nextState.description !== undefined) editOptions.description = nextState.description?.trim() === '' ? undefined : nextState.description;
      if (nextState.address !== undefined) editOptions.address = nextState.address?.trim() === '' ? undefined : nextState.address;
      if (nextState.suggested !== undefined) editOptions.suggested = nextState.suggested;
      if (nextState.rules !== undefined) editOptions.rules = nextState.rules;
      if (nextState.roles !== undefined) editOptions.roles = nextState.roles;
      if (nextState.settings !== undefined) editOptions.settings = nextState.settings;
      if (nextState.communityAddress !== undefined) editOptions.communityAddress = nextState.communityAddress?.trim() === '' ? undefined : nextState.communityAddress;
      nextState.publishCommunityEditOptions = editOptions;
      return nextState;
    }),
  resetCommunitySettingsStore: () =>
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
        communityAddress: undefined,
        isCreateDraft: false,
        publishCommunityEditOptions: {},
      };
    }),
}));

export default useCommunitySettingsStore;
