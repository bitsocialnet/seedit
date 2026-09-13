import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { setAccount, useAccount } from '@bitsocial/bitsocial-react-hooks';
import stringify from 'json-stringify-pretty-compact';
import styles from './account-data-editor.module.css';
import JsonEditor from '../../components/json-editor';
import ErrorDisplay from '../../components/error-display';
import { getEditableAccountData } from '../../lib/utils/account-data-utils';

const AccountDataEditor = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const account = useAccount();
  const [text, setText] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [currentError, setCurrentError] = useState<Error | undefined>(undefined);

  const accountJson = stringify({ account: getEditableAccountData(account) });

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
      <JsonEditor
        name='ACCOUNT_DATA_EDITOR'
        value={text}
        onChange={(value) => {
          setText(value);
          if (currentError) {
            setCurrentError(undefined);
          }
        }}
      />
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
