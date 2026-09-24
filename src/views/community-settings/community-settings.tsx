import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  deleteCommunity,
  Role,
  useAccount,
  useCreateCommunity,
  usePkcRpcSettings,
  usePublishCommunityEdit,
  useCommunity,
  useSubscribe,
} from '@bitsocial/bitsocial-react-hooks';
import { isUserOwnerOrAdmin, Roles } from '../../lib/utils/user-utils';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import { isCreateCommunityView, isCommunitySettingsView } from '../../lib/utils/view-utils';
import useCommunitySettingsStore from '../../stores/use-community-settings-store';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useResolvedCommunityRoute from '../../hooks/use-resolved-community-route';
import useIsCommunityOffline from '../../hooks/use-is-community-offline';
import useStateString from '../../hooks/use-state-string';
import ErrorDisplay from '../../components/error-display';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Markdown from '../../components/markdown';
import Sidebar from '../../components/sidebar';
import Challenges from './challenge-settings';
import { FormattingHelpTable } from '../../components/reply-form';
import styles from './community-settings.module.css';
import startCase from 'lodash/startCase';
import { getDisplayAddress } from '../../lib/utils/address-utils';

const Title = memo(function Title({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const { t } = useTranslation();
  const title = useCommunitySettingsStore((state) => state.title);
  const setCommunitySettingsStore = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);

  return (
    <div className={`${styles.box} ${isReadOnly && !title ? styles.hidden : styles.visible}`}>
      <div className={styles.boxTitle}>{t('title')}</div>
      <div className={styles.boxSubtitle}>{t('a_short_title')}</div>
      <div className={styles.boxInput}>
        {isReadOnly ? <span>{title}</span> : <input type='text' value={title ?? ''} onChange={(e) => setCommunitySettingsStore({ title: e.target.value })} />}
      </div>
    </div>
  );
});

const Description = memo(function Description({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const { t } = useTranslation();
  const description = useCommunitySettingsStore((state) => state.description);
  const setCommunitySettingsStore = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);
  const [showFormattingHelp, setShowFormattingHelp] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className={`${styles.box} ${isReadOnly && !description ? styles.hidden : styles.visible}`}>
      <div className={styles.boxTitle}>{t('description')}</div>
      <div className={styles.boxSubtitle}>{t('shown_in_sidebar')}</div>
      <div className={styles.boxInput}>
        {isReadOnly ? (
          <pre className={styles.readOnlyDescription}>{description}</pre>
        ) : (
          <>
            {!showPreview ? (
              <textarea value={description ?? ''} onChange={(e) => setCommunitySettingsStore({ description: e.target.value })} />
            ) : (
              <div className={styles.preview}>
                <Markdown content={description ?? ''} />
              </div>
            )}
            <div className={styles.bottomArea}>
              {showFormattingHelp && (
                <button className={styles.previewButton} onClick={() => setShowPreview(!showPreview)} disabled={!description}>
                  {showPreview ? t('edit') : t('preview')}
                </button>
              )}
              <span
                className={styles.formattingHelpButton}
                onClick={() => {
                  const nextShowHelp = !showFormattingHelp;
                  setShowFormattingHelp(nextShowHelp);
                  if (!nextShowHelp) {
                    setShowPreview(false);
                  }
                }}
              >
                {showFormattingHelp ? t('hide_help') : t('formatting_help')}
              </span>
            </div>
            {showFormattingHelp && (
              <div className={styles.formattingHelpTable}>
                <FormattingHelpTable />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

const Address = memo(function Address({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const { t } = useTranslation();
  const address = useCommunitySettingsStore((state) => state.address);
  const setCommunitySettingsStore = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);

  const alertCryptoAddressInfo = () => {
    alert(
      `A .bso community address is an ENS name you own, shown by Seedit with a .bso ending instead of .eth.\n1. Register a name (e.g. yourcommunity.eth) at app.ens.domains.\n2. Open that name on ENS and go to Records, then Edit Records.\n3. Add a text record named "bitsocial" and set its value to: ${address}\n4. Enter the matching .bso name (e.g. yourcommunity.bso) as the community address.`,
    );
  };

  return (
    <div className={styles.box}>
      <div className={styles.boxTitle}>{t('address')}</div>
      <div className={styles.boxSubtitle}>
        {t('address_setting_info')}
        <span onClick={alertCryptoAddressInfo}>[?]</span>
      </div>
      <div className={styles.boxInput}>
        {isReadOnly ? (
          <span className={styles.readOnlyAddress}>{getDisplayAddress(address || '')}</span>
        ) : (
          <input aria-label={t('address')} type='text' value={getDisplayAddress(address)} onChange={(e) => setCommunitySettingsStore({ address: e.target.value })} />
        )}
      </div>
    </div>
  );
});

const Rules = memo(function Rules({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const { t } = useTranslation();
  const rules = useCommunitySettingsStore((state) => state.rules);
  const setCommunitySettingsStore = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);
  const lastRuleRef = useRef(null);

  const handleRuleChange = (index: number, newRule: string) => {
    if (!rules) return;
    const updatedRules = [...(rules ?? [])];
    updatedRules[index] = newRule;
    setCommunitySettingsStore({ rules: updatedRules });
  };

  const addedRuleRef = useRef(false);
  const addRule = () => {
    const newRules = rules ? [...rules, ''] : [''];
    setCommunitySettingsStore({ rules: newRules });
    addedRuleRef.current = true;
  };

  useEffect(() => {
    if (!isReadOnly && rules && rules.length > 0 && addedRuleRef.current) {
      (lastRuleRef.current as any).focus({ preventScroll: true });
      addedRuleRef.current = false;
    }
  }, [rules?.length, isReadOnly, rules]);

  const deleteRule = (index: number) => {
    if (rules) {
      const filteredRules = rules.filter((_, i) => i !== index);
      setCommunitySettingsStore({ rules: filteredRules });
    }
  };

  return (
    <div className={`${styles.box} ${isReadOnly && (!rules || rules.length < 1) ? styles.hidden : styles.visible}`}>
      <div className={styles.boxTitle}>{t('rules')}</div>
      <div className={styles.boxSubtitle}>{t('shown_in_sidebar')}</div>
      <div className={styles.boxInput}>
        {!isReadOnly && (
          <button className={styles.addButton} onClick={addRule} disabled={isReadOnly}>
            {t('add_rule')}
          </button>
        )}
        {rules?.map((rule, index) => (
          <div className={`${styles.rule} ${index === 0 && styles.firstRule}`} key={index}>
            Rule #{index + 1}
            {!isReadOnly && <span className={styles.deleteButton} title='Delete Rule' onClick={() => (isReadOnly ? {} : deleteRule(index))} />}
            <br />
            {isReadOnly ? (
              <span className={styles.readOnlyRule}>{rule}</span>
            ) : (
              <input ref={index === rules?.length - 1 ? lastRuleRef : null} value={rule} onChange={(e) => handleRuleChange(index, e.target.value)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

const Moderators = memo(function Moderators({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const { t } = useTranslation();
  const roles = useCommunitySettingsStore((state) => state.roles);
  const setCommunitySettingsStore = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);
  const lastModeratorRef = useRef(null);

  const addedModeratorRef = useRef(false);
  const handleAddModerator = () => {
    if (roles) {
      const newRoles: Roles = { ...roles, '': { role: 'moderator' } };
      setCommunitySettingsStore({ roles: newRoles });
      addedModeratorRef.current = true;
    } else {
      setCommunitySettingsStore({ roles: { '': { role: 'moderator' } } });
      addedModeratorRef.current = true;
    }
  };

  useEffect(() => {
    if (!isReadOnly && roles && Object.keys(roles).length > 0 && addedModeratorRef.current) {
      (lastModeratorRef.current as any).focus({ preventScroll: true });
      addedModeratorRef.current = false;
    }
  }, [roles, isReadOnly]);

  const handleRoleChange = (address: string, newRole: 'owner' | 'admin' | 'moderator') => {
    if (roles) {
      const updatedRole: Role = { role: newRole };
      const updatedRoles: Roles = { ...roles, [address]: updatedRole };
      setCommunitySettingsStore({ roles: updatedRoles });
    }
  };

  const handleDeleteModerator = (address: string) => {
    if (roles) {
      const { [address]: _, ...remainingRoles } = roles;
      setCommunitySettingsStore({ roles: remainingRoles });
    }
  };

  const handleAddressChange = (index: number, newAddress: string) => {
    const rolesArray = Object.entries(roles || {});
    rolesArray[index] = [newAddress, rolesArray[index][1]];
    const updatedRoles = Object.fromEntries(rolesArray);
    setCommunitySettingsStore({ roles: updatedRoles });
  };

  return (
    <div className={`${styles.box} ${isReadOnly && !roles ? styles.hidden : styles.visible}`}>
      <div className={styles.boxTitle}>{t('moderators')}</div>
      <div className={styles.boxSubtitle}>{t('moderators_setting_info')}</div>
      <div className={styles.boxInput}>
        {!isReadOnly && (
          <button className={styles.addButton} onClick={handleAddModerator} disabled={isReadOnly}>
            {t('add_moderator')}
          </button>
        )}
        {roles &&
          Object.entries(roles)?.map(([address, role], index) => (
            <div className={`${styles.moderator} ${index === 0 && styles.firstModerator}`} key={index}>
              {t('moderator')} #{index + 1}
              {!isReadOnly && <span className={styles.deleteButton} title='delete moderator' onClick={() => (isReadOnly ? {} : handleDeleteModerator(address))} />}
              <br />
              <span className={styles.moderatorAddress}>
                User address:
                <br />
                {isReadOnly ? (
                  <span>{getDisplayAddress(address)}</span>
                ) : (
                  <input
                    ref={index === Object.keys(roles).length - 1 ? lastModeratorRef : null}
                    type='text'
                    autoCorrect='off'
                    autoComplete='off'
                    spellCheck='false'
                    value={getDisplayAddress(address)}
                    onChange={(e) => handleAddressChange(index, e.target.value)}
                  />
                )}
                <br />
              </span>
              <span className={styles.moderatorRole}>
                Moderator role:
                <br />
                {isReadOnly ? (
                  <span>{role.role}</span>
                ) : (
                  <select value={role.role} onChange={(e) => handleRoleChange(address, e.target.value as any)}>
                    <option value='moderator'>moderator</option>
                    <option value='admin'>admin</option>
                    <option value='owner'>owner</option>
                  </select>
                )}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
});

const JSONSettings = memo(function JSONSettings({ isReadOnly: _isReadOnly = false }: { isReadOnly?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { communityAddress } = useResolvedCommunityRoute();

  return (
    <div className={`${styles.box}`}>
      <div className={`${styles.boxTitle} ${styles.JSONSettingsTitle}`}>{t('json_settings')}</div>
      <div className={styles.boxSubtitle}>{t('json_settings_info')}</div>
      <div className={`${styles.boxInput} ${styles.JSONSettings}`}>
        <button type='button' onClick={() => communityAddress && navigate(`${getCommunityPath(communityAddress)}/settings/editor`)}>
          {t('edit')}
        </button>
      </div>
    </div>
  );
});

const CommunitySettings = () => {
  const { t } = useTranslation();
  const { communityAddress } = useResolvedCommunityRoute();
  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress) } : undefined);
  const { address, challenges, createdAt, description, error, rules, shortAddress, settings, suggested, roles, title } = community || {};
  const hasLoaded = !!createdAt;

  const { pkcRpcSettings, state: rpcState } = usePkcRpcSettings();
  const { challenges: rpcChallenges } = pkcRpcSettings || {};
  const challengeNames = useMemo(() => Object.keys(rpcChallenges || {}), [rpcChallenges]);

  const account = useAccount();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const isInCreateCommunityView = isCreateCommunityView(location.pathname);
  const isInCommunitySettingsView = isCommunitySettingsView(location.pathname, params);
  const isConnectedToRpc = rpcState === 'connected';

  useEffect(() => {
    if (isInCreateCommunityView && !isConnectedToRpc) {
      navigate('/', { replace: true });
    }
  }, [isInCreateCommunityView, isConnectedToRpc, navigate]);

  const userAddress = account?.author?.address;
  const userIsOwnerOrAdmin = isUserOwnerOrAdmin(roles, userAddress);

  const { isOffline, offlineTitle } = useIsCommunityOffline(community || {});

  // General fields can be edited by owners/admins even without RPC connection
  const isReadOnly = (!settings && isInCommunitySettingsView && !userIsOwnerOrAdmin) || (!isConnectedToRpc && isInCreateCommunityView && !userIsOwnerOrAdmin);

  // Challenges are always read-only when not connected to RPC
  const isChallengesReadOnly = (!isConnectedToRpc || !settings) && !isInCreateCommunityView;

  const publishCommunityEditOptions = useCommunitySettingsStore((state) => state.publishCommunityEditOptions);
  const resetCommunitySettingsStore = useCommunitySettingsStore((state) => state.resetCommunitySettingsStore);
  const setCommunitySettingsStore = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);
  const storeTitle = useCommunitySettingsStore((state) => state.title);
  const { error: publishCommunityEditError, publishCommunityEdit } = usePublishCommunityEdit(publishCommunityEditOptions);
  const { error: createCommunityError, createdCommunity, createCommunity } = useCreateCommunity(publishCommunityEditOptions);

  const [showSaving, setShowSaving] = useState(false);
  const [currentError, setCurrentError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    if (publishCommunityEditError || createCommunityError) {
      setCurrentError(publishCommunityEditError || createCommunityError);
    }
  }, [publishCommunityEditError, createCommunityError]);

  const saveCommunity = async () => {
    try {
      setShowSaving(true);
      setCurrentError(undefined);
      console.log('Saving community with options:', publishCommunityEditOptions);
      await publishCommunityEdit();
      setShowSaving(false);

      if (publishCommunityEditError) {
        setCurrentError(publishCommunityEditError);
        alert(publishCommunityEditError.message || 'Error: ' + publishCommunityEditError);
      } else {
        alert(t('settings_saved', { communityAddress }));
      }
    } catch (e) {
      setShowSaving(false);
      if (e instanceof Error) {
        console.warn(e);
        setCurrentError(e);
        alert(`failed editing community: ${e.message}`);
      } else {
        console.error('An unknown error occurred:', e);
      }
    }
  };

  const [showDeleting, setShowDeleting] = useState(false);
  const _deleteCommunity = async () => {
    if (communityAddress && window.confirm(t('delete_confirm', { value: `s/${getDisplayAddress(shortAddress || '')}`, interpolation: { escapeValue: false } }))) {
      if (window.confirm(t('double_confirm'))) {
        try {
          setShowDeleting(true);
          await deleteCommunity(communityAddress);
          setShowDeleting(false);
          alert(t('community_deleted'));
          navigate('/', { replace: true });
        } catch (e) {
          if (e instanceof Error) {
            console.warn(e);
            alert(`failed deleting community: ${e.message}`);
          } else {
            console.error('An unknown error occurred:', e);
          }
        }
      }
    }
  };

  const _createCommunity = async () => {
    try {
      setShowSaving(true);
      setCurrentError(undefined);
      console.log('Creating community with settings:', publishCommunityEditOptions);
      await createCommunity();
      setShowSaving(false);

      if (createCommunityError) {
        setCurrentError(createCommunityError);
        alert(createCommunityError.message || 'Error: ' + createCommunityError);
      }
    } catch (e) {
      setShowSaving(false);
      if (e instanceof Error) {
        console.warn(e);
        setCurrentError(e);
        alert(`failed creating community: ${e.message}`);
      } else {
        console.error('An unknown error occurred:', e);
      }
    }
  };

  const { subscribe } = useSubscribe({ communityAddress: createdCommunity?.address });

  useEffect(() => {
    if (createdCommunity) {
      console.log('createdCommunity', createdCommunity);
      alert(`community created, address: ${getDisplayAddress(createdCommunity.address || '')}`);

      if (account && createdCommunity.address) {
        subscribe();
      }

      resetCommunitySettingsStore();
      if (createdCommunity.address) {
        navigate(getCommunityPath(createdCommunity.address));
      }
    }
  }, [createdCommunity, navigate, resetCommunitySettingsStore, account, subscribe]);

  const lastViewType = useRef<'create' | 'settings' | 'other' | undefined>(undefined);

  // Initialize store for create view only on first entry or when switching from settings view
  useEffect(() => {
    if (isInCreateCommunityView && lastViewType.current === 'settings') {
      resetCommunitySettingsStore();
      const initialRoles: Roles = account?.author?.address ? { [account.author.address]: { role: 'owner' as const } } : {};
      setCommunitySettingsStore({
        title: '',
        description: '',
        address: undefined,
        suggested: {},
        rules: [],
        roles: initialRoles,
        settings: {},
        challenges: [],
        communityAddress: undefined,
      });
    }
    if (isInCreateCommunityView) {
      lastViewType.current = 'create';
    } else if (isInCommunitySettingsView) {
      lastViewType.current = 'settings';
    } else {
      lastViewType.current = 'other';
    }
  }, [isInCreateCommunityView, storeTitle, resetCommunitySettingsStore, setCommunitySettingsStore, account, isInCommunitySettingsView]);

  // Set store for loaded community settings when editing
  useEffect(() => {
    if (!isInCreateCommunityView && hasLoaded) {
      // Only reset if we're switching to a different community or if store is uninitialized
      const { communityAddress: storeCommunityAddress } = useCommunitySettingsStore.getState();
      const shouldReset = !storeCommunityAddress || storeCommunityAddress !== communityAddress;

      if (shouldReset) {
        resetCommunitySettingsStore();
        setCommunitySettingsStore({
          title: title ?? '',
          description: description ?? '',
          address,
          suggested: suggested ?? {},
          rules: rules ?? [],
          roles: roles ?? {},
          settings: settings ?? {},
          challenges: challenges ?? [],
          communityAddress: communityAddress,
        });
      }
    }
  }, [
    isInCreateCommunityView,
    hasLoaded,
    resetCommunitySettingsStore,
    setCommunitySettingsStore,
    title,
    description,
    address,
    suggested,
    rules,
    roles,
    settings,
    challenges,
    communityAddress,
  ]);

  const documentTitle = useMemo(() => {
    let title;
    if (isInCommunitySettingsView) {
      title = startCase(t('community_settings', { interpolation: { escapeValue: false } }));
    } else if (isInCreateCommunityView) {
      title = startCase(t('create_community', { interpolation: { escapeValue: false } }));
    }
    return `${title} - Seedit`;
  }, [isInCreateCommunityView, isInCommunitySettingsView, t]);

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const loadingStateString = useStateString(community);

  if (!hasLoaded && !isInCreateCommunityView) {
    return (
      <>
        {error?.message && (
          <div className={styles.error}>
            <ErrorDisplay error={error} />
          </div>
        )}
        <div className={styles.loading}>
          <LoadingEllipsis string={loadingStateString || t('loading')} />
        </div>
      </>
    );
  }

  return (
    <div className={styles.content}>
      {!isInCreateCommunityView && (
        <div className={styles.sidebar}>
          <Sidebar community={community} />
        </div>
      )}
      {isReadOnly && !userIsOwnerOrAdmin && <div className={styles.infobar}>{t('owner_settings_notice')}</div>}
      {isOffline && <div className={styles.infobar}>{offlineTitle}</div>}
      {isChallengesReadOnly && <div className={styles.infobar}>cannot read or write challenges, community node isn't reachable.</div>}
      <Title isReadOnly={isReadOnly} />
      <Description isReadOnly={isReadOnly} />
      {!isInCreateCommunityView && <Address isReadOnly={isReadOnly} />}
      <Rules isReadOnly={isReadOnly} />
      <Moderators isReadOnly={isReadOnly} />
      <Challenges isReadOnly={isChallengesReadOnly} readOnlyChallenges={community?.challenges} challengeNames={challengeNames} challengesSettings={rpcChallenges} />
      {!isInCreateCommunityView && <JSONSettings isReadOnly={isReadOnly} />}
      <div className={styles.saveOptions}>
        {!isInCreateCommunityView && !isReadOnly && (
          <div className={`${styles.box} ${styles.deleteCommunity}`}>
            <div className={styles.boxTitle}>{t('delete_community')}</div>
            <div className={styles.boxSubtitle}>{t('delete_community_description')}</div>
            <div className={styles.boxInput}>
              <div className={styles.deleteCommunity}>
                <button onClick={_deleteCommunity} disabled={showDeleting || showSaving}>
                  {t('delete')}
                </button>
                <span className={styles.deletingString}>{showDeleting && <LoadingEllipsis string={t('deleting')} />}</span>
              </div>
            </div>
          </div>
        )}
        {!isReadOnly && (
          <button onClick={() => (isInCreateCommunityView ? _createCommunity() : saveCommunity())} disabled={showSaving || showDeleting}>
            {isInCreateCommunityView ? t('create_community') : t('save_options')}
          </button>
        )}
        {showSaving && <LoadingEllipsis string={t('saving')} />}
        {currentError && (
          <div className={styles.error}>
            <ErrorDisplay error={currentError} />
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunitySettings;
