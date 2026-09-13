import { useEffect, useMemo, useState, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { usePublishCommunityEdit, useCommunity } from '@bitsocial/bitsocial-react-hooks';
import styles from './community-data-editor.module.css';
import JsonEditor from '../../components/json-editor';
import LoadingEllipsis from '../../components/loading-ellipsis';
import useCommunitySettingsStore from '../../stores/use-community-settings-store';
import { useNavigate } from 'react-router-dom';
import ErrorDisplay from '../../components/error-display';
import useStateString from '../../hooks/use-state-string';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useResolvedCommunityRoute from '../../hooks/use-resolved-community-route';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import { removeSuggestedAvatarUrl } from './community-data-editor-utils';

const CommunityDataEditor = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [text, setText] = useState('');

  const { communityAddress } = useResolvedCommunityRoute();
  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress) } : undefined);
  const { address, createdAt, description, error, rules, settings, suggested, roles, title } = community || {};
  const hasLoaded = !!createdAt;

  const {
    publishCommunityEditOptions,
    setCommunitySettingsStore,
    resetCommunitySettingsStore,
    title: storeTitle,
    description: storeDescription,
    address: storeAddress,
    suggested: storeSuggested,
    rules: storeRules,
    roles: storeRoles,
    settings: storeSettings,
    communityAddress: storeCommunityAddress,
  } = useCommunitySettingsStore();

  const { error: publishCommunityEditError, publishCommunityEdit } = usePublishCommunityEdit(publishCommunityEditOptions);

  // Use store state if available, otherwise fall back to original community data
  const currentSettings = useMemo(() => {
    const { communityAddress: storeAddr } = useCommunitySettingsStore.getState();
    const hasStoreData = storeAddr === communityAddress;

    return {
      title: hasStoreData ? storeTitle : title,
      description: hasStoreData ? storeDescription : description,
      address: hasStoreData ? storeAddress : address,
      suggested: removeSuggestedAvatarUrl((hasStoreData ? storeSuggested : suggested) ?? {}),
      rules: hasStoreData ? storeRules : rules,
      roles: hasStoreData ? storeRoles : roles,
      settings: hasStoreData ? storeSettings : settings,
      communityAddress: hasStoreData ? storeCommunityAddress : communityAddress,
    };
  }, [
    storeTitle,
    storeDescription,
    storeAddress,
    storeSuggested,
    storeRules,
    storeRoles,
    storeSettings,
    storeCommunityAddress,
    title,
    description,
    address,
    suggested,
    rules,
    roles,
    settings,
    communityAddress,
  ]);

  const communitySettings = useMemo(() => JSON.stringify(currentSettings, null, 2), [currentSettings]);

  // Update text when settings change, but not when user is actively typing
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  useEffect(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce setting text to avoid interrupting user typing
    timeoutRef.current = setTimeout(() => {
      setText(communitySettings);
    }, 100);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [communitySettings]);

  // Sync editor changes to store immediately when JSON is valid
  const handleTextChange = (newText: string) => {
    setText(newText);

    // Try to sync immediately if JSON is valid
    try {
      const parsedSettings = JSON.parse(newText);
      setCommunitySettingsStore({
        title: parsedSettings.title ?? '',
        description: parsedSettings.description ?? '',
        address: parsedSettings.address,
        suggested: removeSuggestedAvatarUrl(parsedSettings.suggested ?? {}),
        rules: parsedSettings.rules ?? [],
        roles: parsedSettings.roles ?? {},
        settings: parsedSettings.settings ?? {},
        communityAddress: parsedSettings.communityAddress,
      });
    } catch {
      // Invalid JSON - don't spam console during active typing
      // Just silently skip sync until JSON becomes valid
    }
  };

  const [showSaving, setShowSaving] = useState(false);
  const [currentError, setCurrentError] = useState<Error | undefined>(undefined);
  const [triggerSave, setTriggerSave] = useState(false);

  // Effect to perform save after store is updated
  useEffect(() => {
    if (triggerSave) {
      const performSave = async () => {
        try {
          console.log('Performing save with options:', publishCommunityEditOptions);
          await publishCommunityEdit();
          setShowSaving(false);
          setTriggerSave(false);

          if (publishCommunityEditError) {
            setCurrentError(publishCommunityEditError);
            alert(publishCommunityEditError.message || 'Error: ' + publishCommunityEditError);
          } else {
            alert(t('settings_saved', { communityAddress }));
          }
        } catch (e) {
          setShowSaving(false);
          setTriggerSave(false);
          if (e instanceof Error) {
            console.warn(e);
            setCurrentError(e);
            alert(`failed editing community: ${e.message}`);
          } else {
            console.error('An unknown error occurred:', e);
          }
        }
      };
      performSave();
    }
    // Intentionally only depend on triggerSave to prevent multiple executions when publishCommunityEditOptions changes during save
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerSave]);

  const saveCommunitySettings = () => {
    try {
      setShowSaving(true);
      setCurrentError(undefined);
      setTriggerSave(false);

      // Validate JSON before saving
      try {
        JSON.parse(text);
      } catch (parseError) {
        setShowSaving(false);
        const errorMessage = parseError instanceof Error ? parseError.message : 'Invalid JSON format';
        setCurrentError(new Error(`JSON parsing error: ${errorMessage}`));
        alert(`Invalid JSON format: ${errorMessage}`);
        return;
      }

      // Store should already be updated via debounced effect, just trigger save
      setTriggerSave(true);
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

  // Set store for loaded community settings when editing
  useEffect(() => {
    if (hasLoaded) {
      // Only reset if we're switching to a different community or if store is uninitialized
      const { communityAddress: storeCommunityAddress } = useCommunitySettingsStore.getState();
      const shouldReset = !storeCommunityAddress || storeCommunityAddress !== communityAddress;

      if (shouldReset) {
        resetCommunitySettingsStore();
        setCommunitySettingsStore({
          title: title ?? '',
          description: description ?? '',
          address,
          suggested: removeSuggestedAvatarUrl(suggested ?? {}),
          rules: rules ?? [],
          roles: roles ?? {},
          settings: settings ?? {},
          communityAddress: communityAddress,
        });
      }
    }
  }, [hasLoaded, resetCommunitySettingsStore, setCommunitySettingsStore, title, description, address, suggested, rules, roles, settings, communityAddress]);

  const loadingStateString = useStateString(community);

  if (!hasLoaded) {
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
      <JsonEditor name='COMMUNITY_DATA_EDITOR' value={text} onChange={handleTextChange} readOnly={showSaving} />
      {currentError && (
        <div className={styles.error}>
          <ErrorDisplay error={currentError} />
        </div>
      )}
      {showSaving ? (
        <div className={styles.loading}>
          <LoadingEllipsis string={t('saving')} />
        </div>
      ) : (
        <div className={styles.buttons}>
          <Trans
            i18nKey='save_reset_changes'
            components={{
              1: <button key='saveCommunitySettingsButton' onClick={saveCommunitySettings} />,
              2: <button key='resetCommunitySettingsButton' onClick={() => setText(communitySettings)} />,
            }}
          />
          <div>
            <br />
            <button type='button' onClick={() => communityAddress && navigate(`${getCommunityPath(communityAddress)}/settings`)}>
              return to settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityDataEditor;
