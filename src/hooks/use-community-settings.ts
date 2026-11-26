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

  // A new community starts empty, owned by the account and guarded by the default challenge, unless a create draft is
  // already in progress.
  const hasSetDefaultChallenge = useRef(false);
  useEffect(() => {
    if (!isCreating || !account) return;
    const draft = useCommunitySettingsStore.getState();
    const hasCreateDraft = draft.communityAddress === undefined && draft.title !== undefined;
    if (!hasCreateDraft) {
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

  const { error: publishError, publishCommunityEdit } = usePublishCommunityEdit(publishOptions);
  const { error: createError, createdCommunity, createCommunity } = useCreateCommunity(publishOptions);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<Error | undefined>(publishError || createError);

  // Publishing reports failures through the hooks' error state, so each new one is shown; the actions clear or replace it.
  const [previousHookErrors, setPreviousHookErrors] = useState({ publishError, createError });
  if (previousHookErrors.publishError !== publishError || previousHookErrors.createError !== createError) {
    setPreviousHookErrors({ publishError, createError });
    if (publishError || createError) setError(publishError || createError);
  }

  /** Publishes the draft as an edit of the community; resolves true once it is sent without an error thrown. */
  const save = async () => {
    setIsSaving(true);
    setError(undefined);
    let saved = true;
    try {
      await publishCommunityEdit();
    } catch (caught) {
      setError(toError(caught));
      saved = false;
    }
    setIsSaving(false);
    return saved;
  };

  /** Creates the draft as a new community on the connected node; the new community then opens. */
  const create = async () => {
    setIsSaving(true);
    setError(undefined);
    try {
      await createCommunity();
    } catch (caught) {
      setError(toError(caught));
    }
    setIsSaving(false);
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

  /** Deletes the community from the node after two confirmations; resolves true once it is gone. */
  const remove = async () => {
    if (!communityAddress) return false;
    const label = `s/${getDisplayAddress(community?.shortAddress || '')}`;
    if (!window.confirm(t('delete_confirm', { value: label, interpolation: { escapeValue: false } })) || !window.confirm(t('double_confirm'))) return false;
    setIsDeleting(true);
    setError(undefined);
    let deleted = true;
    try {
      await deleteCommunity(communityAddress);
    } catch (caught) {
      setError(toError(caught));
      deleted = false;
    }
    setIsDeleting(false);
    return deleted;
  };

  return {
    community,
    communityAddress,
    hasLoaded,
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
