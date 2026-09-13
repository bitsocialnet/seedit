import React, { useEffect, useMemo, useState, useRef, lazy, Suspense, Component } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { usePublishCommunityEdit, useCommunity } from '@bitsocial/bitsocial-react-hooks';
import useTheme from '../../stores/use-theme-store';
import editorStyles from '../../components/json-editor';
import useIsMobile from '../../hooks/use-is-mobile';
import LoadingEllipsis from '../../components/loading-ellipsis';
import useCommunitySettingsStore from '../../stores/use-community-settings-store';
import { useNavigate } from 'react-router-dom';
import ErrorDisplay from '../../components/error-display';
import useStateString from '../../hooks/use-state-string';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useResolvedCommunityRoute from '../../hooks/use-resolved-community-route';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import { removeSuggestedAvatarUrl } from './community-data-editor-utils';
import { normalizeReactAceModule } from '../../lib/utils/react-ace-utils';

class EditorErrorBoundary extends Component<{ children: React.ReactNode; fallback: React.ReactNode }> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Ace Editor failed to load:', error, errorInfo);
  }

  render() {
    if ((this.state as any).hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const LazyAceEditor = lazy(async () => {
  const ReactAceModule = await import('react-ace');
  await Promise.all([
    import('ace-builds/src-noconflict/mode-json'),
    import('ace-builds/src-noconflict/theme-github'),
    import('ace-builds/src-noconflict/theme-tomorrow_night'),
  ]);
  return normalizeReactAceModule(ReactAceModule);
});

const FallbackEditor = ({ value, onChange, height, disabled }: { value: string; onChange: (value: string) => void; height: string; disabled?: boolean }) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className={editorStyles.infobar}>{t('editor_fallback_warning', 'Advanced editor failed to load. Using basic text editor as fallback.')}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={editorStyles.fallbackEditor}
        style={{ height }}
        spellCheck={false}
        disabled={disabled}
      />
    </div>
  );
};

const CommunityDataEditor = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const theme = useTheme((state) => state.theme);
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
          <div className={editorStyles.error}>
            <ErrorDisplay error={error} />
          </div>
        )}
        <div className={editorStyles.loading}>
          <LoadingEllipsis string={loadingStateString || t('loading')} />
        </div>
      </>
    );
  }

  return (
    <div className={editorStyles.content}>
      <EditorErrorBoundary
        fallback={<FallbackEditor value={text} onChange={handleTextChange} height={isMobile ? 'calc(80vh - 95px)' : 'calc(90vh - 77px)'} disabled={showSaving} />}
      >
        <Suspense
          fallback={
            <div className={editorStyles.loading}>
              <LoadingEllipsis string={t('loading_editor')} />
            </div>
          }
        >
          <LazyAceEditor
            mode='json'
            theme={theme === 'dark' ? 'tomorrow_night' : 'github'}
            value={text}
            onChange={handleTextChange}
            name='ACCOUNT_DATA_EDITOR'
            editorProps={{ $blockScrolling: true }}
            className={editorStyles.editor}
            width='100%'
            height={isMobile ? 'calc(80vh - 95px)' : 'calc(90vh - 77px)'}
            setOptions={{
              useWorker: false,
              enableBasicAutocompletion: false,
              enableLiveAutocompletion: false,
              enableSnippets: false,
              showPrintMargin: false,
              highlightActiveLine: true,
              showGutter: true,
              foldStyle: 'markbeginend',
              showFoldWidgets: true,
              readOnly: showSaving,
            }}
            fontSize={14}
          />
        </Suspense>
      </EditorErrorBoundary>
      {currentError && (
        <div className={editorStyles.error}>
          <ErrorDisplay error={currentError} />
        </div>
      )}
      {showSaving ? (
        <div className={editorStyles.loading}>
          <LoadingEllipsis string={t('saving')} />
        </div>
      ) : (
        <div className={editorStyles.buttons}>
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
