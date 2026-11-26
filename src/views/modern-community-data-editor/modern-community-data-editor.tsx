import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import useCommunityDataEditor from '../../hooks/use-community-data-editor';
import useStateString from '../../hooks/use-state-string';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import JsonEditor from '../../components/json-editor';
import { ModernColumns, modernStyles } from '../../components/modern-layout';
import { settingsStyles } from '../../components/modern-settings-section';
import styles from './modern-community-data-editor.module.css';

/** A community's settings draft as raw JSON, shared with its settings page. */
const ModernCommunityDataEditor = () => {
  const { t } = useTranslation();
  const { community, communityAddress, loadError, hasFailedToLoad, isReady, text, setText, isDirty, reset, save, isSaving, isSaved, error } = useCommunityDataEditor();
  const loadingState = useStateString(community);
  const settingsPath = communityAddress ? `${getCommunityPath(communityAddress)}/settings` : '/';
  const displayAddress = getDisplayAddress(community?.shortAddress || communityAddress);

  const heading = t('json_settings');
  useEffect(() => {
    document.title = `${heading} - Seedit`;
  }, [heading]);

  return (
    <ModernColumns>
      <header className={settingsStyles.header}>
        <h1 className={settingsStyles.heading}>{heading}</h1>
        {communityAddress && (
          <Link to={getCommunityPath(communityAddress)} className={styles.subheading}>
            s/{displayAddress}
          </Link>
        )}
      </header>
      {isReady ? (
        <div className={styles.editor}>
          <p className={settingsStyles.description}>{t('json_settings_info')}</p>
          <JsonEditor name='COMMUNITY_DATA_EDITOR' value={text} onChange={setText} readOnly={isSaving} />
          <div className={styles.actions}>
            <p className={settingsStyles.status} role='status'>
              {error ? (
                <span className={settingsStyles.statusError}>{error.message}</span>
              ) : isSaving ? (
                `${t('saving')}…`
              ) : isSaved ? (
                <span className={settingsStyles.statusSuccess}>{t('settings_saved', { communityAddress: displayAddress })}</span>
              ) : null}
            </p>
            <Link to={settingsPath} className={modernStyles.secondaryButton}>
              <span className={modernStyles.sentenceCase}>{t('go_back')}</span>
            </Link>
            <button type='button' className={`${modernStyles.secondaryButton} ${settingsStyles.button}`} onClick={reset} disabled={!isDirty || isSaving}>
              <span className={modernStyles.sentenceCase}>{t('undo')}</span>
            </button>
            <button type='button' className={modernStyles.primaryButton} onClick={() => void save()} disabled={isSaving}>
              <span className={modernStyles.sentenceCase}>{t('save')}</span>
            </button>
          </div>
        </div>
      ) : (
        <p className={`${settingsStyles.status} ${styles.loading}`} role='status'>
          {loadError?.message ? (
            <span className={settingsStyles.statusError}>{loadError.message}</span>
          ) : hasFailedToLoad ? (
            t('failed')
          ) : (
            loadingState || `${t('loading')}…`
          )}
        </p>
      )}
    </ModernColumns>
  );
};

export default ModernCommunityDataEditor;
