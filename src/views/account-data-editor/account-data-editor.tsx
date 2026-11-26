import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from './account-data-editor.module.css';
import JsonEditor from '../../components/json-editor';
import ErrorDisplay from '../../components/error-display';
import useAccountDataEditor from '../../hooks/use-account-data-editor';

const AccountDataEditor = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showEditor, setShowEditor] = useState(false);
  const { text, setText, reset, save: saveAccount, error: currentError } = useAccountDataEditor();

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
      <JsonEditor name='ACCOUNT_DATA_EDITOR' value={text} onChange={setText} />
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
            2: <button key='resetAccountButton' onClick={reset} />,
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
