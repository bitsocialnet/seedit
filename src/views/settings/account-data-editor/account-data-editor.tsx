import React, { useEffect, useMemo, useState, lazy, Suspense, Component } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { setAccount, useAccount } from '@bitsocialnet/bitsocial-react-hooks';
import useTheme from '../../../stores/use-theme-store';
import stringify from 'json-stringify-pretty-compact';
import styles from './account-data-editor.module.css';
import useIsMobile from '../../../hooks/use-is-mobile';
import LoadingEllipsis from '../../../components/loading-ellipsis';
import ErrorDisplay from '../../../components/error-display';

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

const FallbackEditor = ({ value, onChange, height }: { value: string; onChange: (value: string) => void; height: string }) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className={styles.infobar}>{t('editor_fallback_warning', 'Advanced editor failed to load. Using basic text editor as fallback.')}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className={styles.fallbackEditor} style={{ height }} spellCheck={false} />
    </div>
  );
};

const AccountDataEditor = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const account = useAccount();
  const theme = useTheme((state) => state.theme);
  const [text, setText] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [currentError, setCurrentError] = useState<Error | undefined>(undefined);

  const accountJson = useMemo(() => stringify({ account: { ...account, plebbit: undefined, karma: undefined, unreadNotificationCount: undefined } }), [account]);

  useEffect(() => {
    setText(accountJson);
  }, [accountJson]);

  const saveAccount = async () => {
    try {
      setCurrentError(undefined);
      const editorAccount = JSON.parse(text).account;
      await setAccount(editorAccount);
      alert(`Saved ${editorAccount.name}`);
      navigate('/settings');
      window.location.reload();
    } catch (error) {
      if (error instanceof Error) {
        setCurrentError(error);
        alert(error.message);
        console.log(error);
      } else {
        const unknownError = new Error('An unknown error occurred');
        setCurrentError(unknownError);
        console.error('An unknown error occurred:', error);
      }
    }
  };

  if (!showEditor) {
    return (
      <div className={styles.securityWarning}>
        <img src='assets/privacy_icon.png' alt='' />
        <div className={styles.warning}>
          <h3>{t('private_key_warning_title')}</h3>
          <p>{t('private_key_warning_description')}</p>
        </div>
        <div className={styles.warningButtons}>
          <button onClick={() => navigate('/settings')}>{t('go_back')}</button>
          <button onClick={() => setShowEditor(true)}>{t('continue')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <EditorErrorBoundary
        fallback={
          <FallbackEditor
            value={text}
            onChange={(value) => {
              setText(value);
              if (currentError) {
                setCurrentError(undefined);
              }
            }}
            height={isMobile ? 'calc(80vh - 95px)' : 'calc(90vh - 77px)'}
          />
        }
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
            onChange={(value) => {
              setText(value);
              if (currentError) {
                setCurrentError(undefined);
              }
            }}
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
      <div className={styles.buttons}>
        <Trans
          i18nKey='save_reset_changes'
          components={{
            1: <button key='saveAccountButton' onClick={saveAccount} />,
            2: <button key='resetAccountButton' onClick={() => setText(accountJson)} />,
          }}
        />
        <div>
          <br />
          <button onClick={() => navigate('/settings')}>return to settings</button>
        </div>
      </div>
    </div>
  );
};

export default AccountDataEditor;
