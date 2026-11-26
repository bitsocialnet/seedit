import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import useAccountDataEditor from '../../hooks/use-account-data-editor';
import ErrorDisplay from '../../components/error-display';
import JsonEditor from '../../components/json-editor';
import { ModernColumns, modernStyles } from '../../components/modern-layout';
import styles from './modern-account-data-editor.module.css';

/** The account's raw data, including its private key, behind a warning; saving reloads the app. */
const ModernAccountDataEditor = () => {
  const { t } = useTranslation();
  const [showEditor, setShowEditor] = useState(false);
  const { text, setText, isDirty, reset, save, error } = useAccountDataEditor();

  useEffect(() => {
    document.title = `${t('preferences').charAt(0).toUpperCase()}${t('preferences').slice(1)} - Seedit`;
  }, [t]);

  return (
    <ModernColumns>
      {showEditor ? (
        <div className={styles.editor}>
          <JsonEditor name='ACCOUNT_DATA_EDITOR' value={text} onChange={setText} />
          {error && (
            <div className={styles.error}>
              <ErrorDisplay error={error} />
            </div>
          )}
          <div className={styles.actions}>
            <Link to='/settings#exportAccount' className={modernStyles.secondaryButton}>
              <span className={modernStyles.sentenceCase}>{t('go_back')}</span>
            </Link>
            <button type='button' className={`${modernStyles.secondaryButton} ${styles.button}`} onClick={reset} disabled={!isDirty}>
              <span className={modernStyles.sentenceCase}>{t('undo')}</span>
            </button>
            <button type='button' className={modernStyles.primaryButton} onClick={() => void save()}>
              <span className={modernStyles.sentenceCase}>{t('save')}</span>
            </button>
          </div>
        </div>
      ) : (
        <section className={styles.warning} aria-labelledby='account-data-warning'>
          <img src='assets/privacy_icon.png' alt='' width={64} height={64} />
          <h1 id='account-data-warning' className={styles.title}>
            {t('private_key_warning_title')}
          </h1>
          <p className={styles.description}>{t('private_key_warning_description')}</p>
          <div className={styles.actions}>
            <Link to='/settings#exportAccount' className={modernStyles.secondaryButton}>
              <span className={modernStyles.sentenceCase}>{t('go_back')}</span>
            </Link>
            <button type='button' className={modernStyles.primaryButton} onClick={() => setShowEditor(true)}>
              <span className={modernStyles.sentenceCase}>{t('continue')}</span>
            </button>
          </div>
        </section>
      )}
    </ModernColumns>
  );
};

export default ModernAccountDataEditor;
