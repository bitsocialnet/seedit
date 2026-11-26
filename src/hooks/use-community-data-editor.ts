import { useState } from 'react';
import { removeSuggestedAvatarUrl } from '../lib/utils/community-data-editor-utils';
import useCommunitySettingsStore, { type CommunitySettingsState } from '../stores/use-community-settings-store';
import useCommunitySettings from './use-community-settings';

type DraftFields = Pick<CommunitySettingsState, 'title' | 'description' | 'address' | 'suggested' | 'rules' | 'roles' | 'settings' | 'communityAddress'>;

/** The draft as the editor shows it; the community's avatar is left out. */
const toDraftJson = ({ title, description, address, suggested, rules, roles, settings, communityAddress }: DraftFields) =>
  JSON.stringify({ title, description, address, suggested: removeSuggestedAvatarUrl(suggested ?? {}), rules, roles, settings, communityAddress }, null, 2);

/**
 * The route's community settings draft as editable JSON, shared with the settings page; both interfaces' JSON editors
 * use it. Valid JSON goes into the draft as it is typed, so saving publishes what the editor shows.
 */
const useCommunityDataEditor = () => {
  const { community, communityAddress, hasLoaded, isSaving, error, save } = useCommunitySettings();
  const title = useCommunitySettingsStore((state) => state.title);
  const description = useCommunitySettingsStore((state) => state.description);
  const address = useCommunitySettingsStore((state) => state.address);
  const suggested = useCommunitySettingsStore((state) => state.suggested);
  const rules = useCommunitySettingsStore((state) => state.rules);
  const roles = useCommunitySettingsStore((state) => state.roles);
  const settings = useCommunitySettingsStore((state) => state.settings);
  const draftCommunityAddress = useCommunitySettingsStore((state) => state.communityAddress);
  const setDraft = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);
  // the draft is set up from the community once it loads
  const isReady = hasLoaded && draftCommunityAddress === communityAddress;
  const draftJson = toDraftJson({ title, description, address, suggested, rules, roles, settings, communityAddress: draftCommunityAddress });

  // Typed text shows while the draft is the one it produced; a draft changed elsewhere replaces it.
  const [typed, setTyped] = useState<{ draftJson: string; text: string }>();
  const text = typed?.draftJson === draftJson ? typed.text : draftJson;
  // the draft as it was before this editor changed it, for undo
  const [original, setOriginal] = useState<string>();
  const [savedText, setSavedText] = useState<string>();

  const parse = (value: string): { fields?: DraftFields; error?: Error } => {
    try {
      const parsed = JSON.parse(value);
      return {
        fields: {
          title: parsed.title ?? '',
          description: parsed.description ?? '',
          address: parsed.address,
          // the JSON leaves out the avatar, which the community keeps
          suggested: { ...(removeSuggestedAvatarUrl(parsed.suggested ?? {}) as object), ...(suggested?.avatarUrl ? { avatarUrl: suggested.avatarUrl } : {}) },
          rules: parsed.rules ?? [],
          roles: parsed.roles ?? {},
          settings: parsed.settings ?? {},
          communityAddress: parsed.communityAddress,
        },
      };
    } catch (caught) {
      return { error: new Error(`JSON parsing error: ${caught instanceof Error ? caught.message : 'invalid JSON'}`) };
    }
  };

  const setText = (value: string) => {
    if (original === undefined) setOriginal(draftJson);
    const { fields } = parse(value);
    if (fields) setDraft(fields);
    // the store updates synchronously, so this is the draft the next render shows
    setTyped({ draftJson: fields ? toDraftJson(useCommunitySettingsStore.getState()) : draftJson, text: value });
  };

  const parseError = parse(text).error;
  // invalid JSON is reported when a save is tried, not while it is being typed
  const [rejectedText, setRejectedText] = useState<string>();

  /** Publishes the draft; resolves true once it is sent without an error thrown. */
  const saveDraft = async () => {
    if (parseError) {
      setRejectedText(text);
      return false;
    }
    const saved = await save();
    if (saved) {
      setSavedText(text);
      setOriginal(undefined);
    }
    return saved;
  };

  return {
    community,
    communityAddress,
    isReady,
    text,
    setText,
    isDirty: original !== undefined && text !== original,
    reset: () => {
      if (original !== undefined) setText(original);
    },
    save: saveDraft,
    isSaving,
    isSaved: savedText === text && !error && !isSaving,
    error: (rejectedText === text ? parseError : undefined) || error,
  };
};

export default useCommunityDataEditor;
