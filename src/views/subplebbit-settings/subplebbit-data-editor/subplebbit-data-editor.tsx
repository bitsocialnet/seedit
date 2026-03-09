import React, { useEffect, useMemo, useState, useRef, lazy, Suspense, Component } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { usePublishSubplebbitEdit, useSubplebbit } from '@bitsocialnet/bitsocial-react-hooks';
import useTheme from '../../../stores/use-theme-store';
import styles from '../../settings/account-data-editor/account-data-editor.module.css';
import useIsMobile from '../../../hooks/use-is-mobile';
import LoadingEllipsis from '../../../components/loading-ellipsis';
import useSubplebbitSettingsStore from '../../../stores/use-subplebbit-settings-store';
import { useNavigate, useParams } from 'react-router-dom';
import ErrorDisplay from '../../../components/error-display';
import useStateString from '../../../hooks/use-state-string';

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
  await import('ace-builds/src-noconflict/mode-json');
  await import('ace-builds/src-noconflict/theme-github');
  await import('ace-builds/src-noconflict/theme-tomorrow_night');
  return ReactAceModule;
});

const FallbackEditor = ({ value, onChange, height, disabled }: { value: string; onChange: (value: string) => void; height: string; disabled?: boolean }) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className={styles.infobar}>{t('editor_fallback_warning', 'Advanced editor failed to load. Using basic text editor as fallback.')}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className={styles.fallbackEditor} style={{ height }} spellCheck={false} disabled={disabled} />
    </div>
  );
};

const SubplebbitDataEditor = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const theme = useTheme((state) => state.theme);
  const [text, setText] = useState('');

  const { subplebbitAddress } = useParams<{ subplebbitAddress: string }>();
  const subplebbit = useSubplebbit({ subplebbitAddress });
  const { address, createdAt, description, error, rules, settings, suggested, roles, title } = subplebbit || {};
  const hasLoaded = !!createdAt;

  const {
    publishSubplebbitEditOptions,
    setSubplebbitSettingsStore,
    resetSubplebbitSettingsStore,
    title: storeTitle,
    description: storeDescription,
    address: storeAddress,
    suggested: storeSuggested,
    rules: storeRules,
    roles: storeRoles,
    settings: storeSettings,
    subplebbitAddress: storeSubplebbitAddress,
  } = useSubplebbitSettingsStore();

  const { error: publishSubplebbitEditError, publishSubplebbitEdit } = usePublishSubplebbitEdit(publishSubplebbitEditOptions);

  // Use store state if available, otherwise fall back to original subplebbit data
  const currentSettings = useMemo(() => {
    const { subplebbitAddress: storeAddr } = useSubplebbitSettingsStore.getState();
    const hasStoreData = storeAddr === subplebbitAddress;

    return {
      title: hasStoreData ? storeTitle : title,
      description: hasStoreData ? storeDescription : description,
      address: hasStoreData ? storeAddress : address,
      suggested: hasStoreData ? storeSuggested : suggested,
      rules: hasStoreData ? storeRules : rules,
      roles: hasStoreData ? storeRoles : roles,
      settings: hasStoreData ? storeSettings : settings,
      subplebbitAddress: hasStoreData ? storeSubplebbitAddress : subplebbitAddress,
    };
  }, [
    storeTitle,
    storeDescription,
    storeAddress,
    storeSuggested,
    storeRules,
    storeRoles,
    storeSettings,
    storeSubplebbitAddress,
    title,
    description,
    address,
    suggested,
    rules,
    roles,
    settings,
    subplebbitAddress,
  ]);

  const subplebbitSettings = useMemo(() => JSON.stringify(currentSettings, null, 2), [currentSettings]);

  // Update text when settings change, but not when user is actively typing
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  useEffect(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce setting text to avoid interrupting user typing
    timeoutRef.current = setTimeout(() => {
      setText(subplebbitSettings);
    }, 100);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [subplebbitSettings]);

  // Sync editor changes to store immediately when JSON is valid
  const handleTextChange = (newText: string) => {
    setText(newText);

    // Try to sync immediately if JSON is valid
    try {
      const parsedSettings = JSON.parse(newText);
      setSubplebbitSettingsStore({
        title: parsedSettings.title ?? '',
        description: parsedSettings.description ?? '',
        address: parsedSettings.address,
        suggested: parsedSettings.suggested ?? {},
        rules: parsedSettings.rules ?? [],
        roles: parsedSettings.roles ?? {},
        settings: parsedSettings.settings ?? {},
        subplebbitAddress: parsedSettings.subplebbitAddress,
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
          console.log('Performing save with options:', publishSubplebbitEditOptions);
          await publishSubplebbitEdit();
          setShowSaving(false);
          setTriggerSave(false);

          if (publishSubplebbitEditError) {
            setCurrentError(publishSubplebbitEditError);
            alert(publishSubplebbitEditError.message || 'Error: ' + publishSubplebbitEditError);
          } else {
            alert(t('settings_saved', { subplebbitAddress }));
          }
        } catch (e) {
          setShowSaving(false);
          setTriggerSave(false);
          if (e instanceof Error) {
            console.warn(e);
            setCurrentError(e);
            alert(`failed editing subplebbit: ${e.message}`);
          } else {
            console.error('An unknown error occurred:', e);
          }
        }
      };
      performSave();
    }
    // Intentionally only depend on triggerSave to prevent multiple executions when publishSubplebbitEditOptions changes during save
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerSave]);

  const saveSubplebbitSettings = () => {
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
        alert(`failed editing subplebbit: ${e.message}`);
      } else {
        console.error('An unknown error occurred:', e);
      }
    }
  };

  // Set store for loaded subplebbit settings when editing
  useEffect(() => {
    if (hasLoaded) {
      // Only reset if we're switching to a different subplebbit or if store is uninitialized
      const { subplebbitAddress: storeSubplebbitAddress } = useSubplebbitSettingsStore.getState();
      const shouldReset = !storeSubplebbitAddress || storeSubplebbitAddress !== subplebbitAddress;

      if (shouldReset) {
        resetSubplebbitSettingsStore();
        setSubplebbitSettingsStore({
          title: title ?? '',
          description: description ?? '',
          address,
          suggested: suggested ?? {},
          rules: rules ?? [],
          roles: roles ?? {},
          settings: settings ?? {},
          subplebbitAddress,
        });
      }
    }
  }, [hasLoaded, resetSubplebbitSettingsStore, setSubplebbitSettingsStore, title, description, address, suggested, rules, roles, settings, subplebbitAddress]);

  const loadingStateString = useStateString(subplebbit);

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
      <EditorErrorBoundary
        fallback={<FallbackEditor value={text} onChange={handleTextChange} height={isMobile ? 'calc(80vh - 95px)' : 'calc(90vh - 77px)'} disabled={showSaving} />}
      >
        <Suspense
          fallback={
            <div className={styles.loading}>
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
            className={styles.editor}
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
              1: <button key='saveSubplebbitSettingsButton' onClick={saveSubplebbitSettings} />,
              2: <button key='resetSubplebbitSettingsButton' onClick={() => setText(subplebbitSettings)} />,
            }}
          />
          <div>
            <br />
            <button onClick={() => navigate(`/s/${subplebbitAddress}/settings`)}>return to settings</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubplebbitDataEditor;
