import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  deleteCommunity,
  useAccount,
  useCommunity,
  useCreateCommunity,
  usePkcRpcSettings,
  usePublishCommunityEdit,
  useSubscribe,
} from '@bitsocial/bitsocial-react-hooks';
import { getDisplayAddress } from '../lib/utils/address-utils';
import { DEFAULT_CHALLENGE_NAME } from '../lib/utils/challenge-settings-utils';
import { getCommunityLoadError } from '../lib/utils/community-load-utils';
import { getCommunityPath } from '../lib/utils/community-route-utils';
import { isUserOwnerOrAdmin, type Roles } from '../lib/utils/user-utils';
import { isCommunitySettingsView, isCreateCommunityView } from '../lib/utils/view-utils';
import useCommunitySettingsStore from '../stores/use-community-settings-store';
import useChallengesOptions from './use-challenges-options';
import { getCommunityIdentifier } from './use-community-identifier';
import useResolvedCommunityRoute from './use-resolved-community-route';

const toError = (caught: unknown) => (caught instanceof Error ? caught : new Error(String(caught)));

/**
 * A community's settings draft, kept in the community settings store, and the actions that save, create or delete it; both
 * interfaces' community settings and creation pages use it. On /communities/create the draft is a new community owned by
 * the account; elsewhere it is the route's community, loaded once it arrives.
 */
const useCommunitySettings = ({ onCreated }: { onCreated?: (address: string) => void } = {}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const params = useParams();
  const isCreating = isCreateCommunityView(pathname);
  const isEditing = isCommunitySettingsView(pathname, params);

  const { communityAddress } = useResolvedCommunityRoute();
  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress) } : undefined);
  const { address, challenges, createdAt, description, rules, settings, suggested, roles, title } = community || {};
  const hasLoaded = Boolean(createdAt);

  const account = useAccount();
  const { pkcRpcSettings, state: rpcState } = usePkcRpcSettings();
  const challengesSettings = pkcRpcSettings?.challenges;
  const challengeNames = Object.keys(challengesSettings ?? {});
  const challengeOptions = useChallengesOptions();
  const isConnectedToRpc = rpcState === 'connected';

  const isOwnerOrAdmin = isUserOwnerOrAdmin(roles, account?.author?.address);
  // Settings are readable only on the node that runs the community; owners and admins can still edit the public fields.
  const isReadOnly = (!settings && isEditing && !isOwnerOrAdmin) || (!isConnectedToRpc && isCreating && !isOwnerOrAdmin);
  // Challenges live in the private settings, which only the community's own node can read or write.
  const isChallengesReadOnly = (!isConnectedToRpc || !settings) && !isCreating;

  const publishOptions = useCommunitySettingsStore((state) => state.publishCommunityEditOptions);
  const setDraft = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);
  const resetDraft = useCommunitySettingsStore((state) => state.resetCommunitySettingsStore);

  // A new community starts empty, owned by the account and guarded by the default challenge, unless the store, which
  // outlives these pages, already holds a create draft.
  const hasSetDefaultChallenge = useRef(false);
  useEffect(() => {
    if (!isCreating || !account) return;
    if (!useCommunitySettingsStore.getState().isCreateDraft) {
      const ownerAddress = account.author?.address;
      resetDraft();
      setDraft({
        title: '',
        description: '',
        suggested: {},
        rules: [],
        roles: (ownerAddress ? { [ownerAddress]: { role: 'owner' } } : {}) as Roles,
        settings: {},
        challenges: [],
        isCreateDraft: true,
      });
    }
    const draftSettings = useCommunitySettingsStore.getState().settings;
    if (hasSetDefaultChallenge.current || !challengesSettings || draftSettings?.challenges?.length) return;
    const name = challengesSettings[DEFAULT_CHALLENGE_NAME] ? DEFAULT_CHALLENGE_NAME : challengeNames[0] || Object.keys(challengeOptions)[0];
    if (!name) return;
    setDraft({ settings: { ...draftSettings, challenges: [{ name, options: challengeOptions[name] || {} }] } });
    hasSetDefaultChallenge.current = true;
  }, [isCreating, account, challengesSettings, challengeNames, challengeOptions, resetDraft, setDraft]);

  // An existing community's draft starts from its loaded settings, and is kept while the same community stays open.
  useEffect(() => {
    if (isCreating || !hasLoaded || useCommunitySettingsStore.getState().communityAddress === communityAddress) return;
    resetDraft();
    setDraft({
      title: title ?? '',
      description: description ?? '',
      address,
      suggested: suggested ?? {},
      rules: rules ?? [],
      roles: roles ?? {},
      settings: settings ?? {},
      challenges: challenges ?? [],
      communityAddress,
    });
  }, [isCreating, hasLoaded, communityAddress, title, description, address, suggested, rules, roles, settings, challenges, resetDraft, setDraft]);

  // the hooks catch save and create errors and report them only through onError and a later render, so the actions
  // read the outcome of the call they awaited from this ref
  const actionErrorRef = useRef<Error | undefined>(undefined);
  const actionOptions = {
    ...publishOptions,
    onError: (actionError: Error) => {
      actionErrorRef.current = actionError;
    },
  };
  const { error: publishError, publishCommunityEdit } = usePublishCommunityEdit(actionOptions);
  const { error: createError, createdCommunity, createCommunity } = useCreateCommunity(actionOptions);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<Error | undefined>(publishError || createError);

  // Publishing reports failures through the hooks' error state, so each new one is shown; the actions clear or replace it.
  const [previousHookErrors, setPreviousHookErrors] = useState({ publishError, createError });
  if (previousHookErrors.publishError !== publishError || previousHookErrors.createError !== createError) {
    setPreviousHookErrors({ publishError, createError });
    if (publishError || createError) setError(publishError || createError);
  }

  /** Publishes the draft as an edit of the community; resolves the error it failed with, if any. */
  const save = async (): Promise<Error | undefined> => {
    setIsSaving(true);
    setError(undefined);
    actionErrorRef.current = undefined;
    try {
      await publishCommunityEdit();
    } catch (caught) {
      actionErrorRef.current = toError(caught);
    }
    // onError may have set it during the await
    const saveError = actionErrorRef.current;
    if (saveError) setError(saveError);
    setIsSaving(false);
    return saveError;
  };

  /** Creates the draft as a new community on the connected node; the new community then opens. */
  const create = async (): Promise<Error | undefined> => {
    setIsSaving(true);
    setError(undefined);
    actionErrorRef.current = undefined;
    try {
      await createCommunity();
    } catch (caught) {
      actionErrorRef.current = toError(caught);
    }
    // onError may have set it during the await
    const createError = actionErrorRef.current;
    if (createError) setError(createError);
    setIsSaving(false);
    return createError;
  };

  const { subscribe } = useSubscribe({ communityAddress: createdCommunity?.address });
  const openCreatedCommunity = useEffectEvent((createdAddress: string) => {
    onCreated?.(createdAddress);
    if (account) void subscribe();
    resetDraft();
    navigate(getCommunityPath(createdAddress));
  });
  useEffect(() => {
    if (createdCommunity?.address) openCreatedCommunity(createdCommunity.address);
  }, [createdCommunity]);

  /** Deletes the community from the node after two confirmations; resolves whether it is gone, and why not if it failed. */
  const remove = async (): Promise<{ deleted: boolean; error?: Error }> => {
    if (!communityAddress) return { deleted: false };
    const label = `s/${getDisplayAddress(community?.shortAddress || '')}`;
    if (!window.confirm(t('delete_confirm', { value: label, interpolation: { escapeValue: false } })) || !window.confirm(t('double_confirm'))) return { deleted: false };
    setIsDeleting(true);
    setError(undefined);
    let result: { deleted: boolean; error?: Error } = { deleted: true };
    try {
      await deleteCommunity(communityAddress);
    } catch (caught) {
      result = { deleted: false, error: toError(caught) };
      setError(result.error);
    }
    setIsDeleting(false);
    return result;
  };

  return {
    community,
    communityAddress,
    hasLoaded,
    /** Why the community has not loaded; pkc-js keeps retrying, so a failed first load reports its last retry's error. */
    loadError: getCommunityLoadError(community),
    /** The community's first load failed for good. */
    hasFailedToLoad: community?.state === 'failed',
    isCreating,
    isConnectedToRpc,
    /** The account's node runs this community, so its private settings are readable. */
    isHostedHere: Boolean(settings),
    isOwnerOrAdmin,
    isReadOnly,
    isChallengesReadOnly,
    challengeNames,
    challengesSettings,
    isSaving,
    isDeleting,
    error,
    save,
    create,
    remove,
  };
};

export default useCommunitySettings;
