import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import type { IAceOptions } from 'react-ace';
import { useTranslation } from 'react-i18next';
import useIsMobile from '../../hooks/use-is-mobile';
import useTheme from '../../stores/use-theme-store';
import { normalizeReactAceModule } from '../../lib/utils/react-ace-utils';
import LoadingEllipsis from '../loading-ellipsis';
import styles from './json-editor.module.css';

type EditorErrorBoundaryProps = { children: ReactNode; fallback: ReactNode };

class EditorErrorBoundary extends Component<EditorErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: EditorErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('Ace Editor failed to load:', error, errorInfo);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
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

const ACE_OPTIONS: IAceOptions = {
  useWorker: false,
  enableBasicAutocompletion: false,
  enableLiveAutocompletion: false,
  enableSnippets: false,
  showPrintMargin: false,
  highlightActiveLine: true,
  showGutter: true,
  foldStyle: 'markbeginend',
  showFoldWidgets: true,
};

type FallbackEditorProps = { value: string; onChange: (value: string) => void; height: string; disabled?: boolean };

const FallbackEditor = ({ value, onChange, height, disabled }: FallbackEditorProps) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className={styles.infobar}>{t('editor_fallback_warning', 'Advanced editor failed to load. Using basic text editor as fallback.')}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className={styles.fallbackEditor} style={{ height }} spellCheck={false} disabled={disabled} />
    </div>
  );
};

export interface JsonEditorProps {
  /** Ace editor element id; give each mounted editor its own. */
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** Locks the Ace editor and the textarea fallback while set, e.g. during a save. */
  readOnly?: boolean;
}

const JsonEditor = ({ name, value, onChange, readOnly }: JsonEditorProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const theme = useTheme((state) => state.theme);
  const height = isMobile ? 'calc(80vh - 95px)' : 'calc(90vh - 77px)';

  return (
    <EditorErrorBoundary fallback={<FallbackEditor value={value} onChange={onChange} height={height} disabled={readOnly} />}>
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
          value={value}
          onChange={onChange}
          name={name}
          editorProps={{ $blockScrolling: true }}
          className={styles.editor}
          width='100%'
          height={height}
          // Forward readOnly into setOptions only when the caller controls it; react-ace still applies its own default
          // (readOnly=false) on mount, so an uncontrolled caller gets the same option calls it made before.
          setOptions={readOnly === undefined ? ACE_OPTIONS : { ...ACE_OPTIONS, readOnly }}
          fontSize={14}
        />
      </Suspense>
    </EditorErrorBoundary>
  );
};

export default JsonEditor;
