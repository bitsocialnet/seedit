import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useCommunityDataEditor from '../../hooks/use-community-data-editor';
import useStateString from '../../hooks/use-state-string';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import ErrorDisplay from '../../components/error-display';
import JsonEditor from '../../components/json-editor';
import LoadingEllipsis from '../../components/loading-ellipsis';
import styles from './community-data-editor.module.css';

const CommunityDataEditor = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { community, communityAddress, loadError, hasFailedToLoad, isReady, text, setText, reset, save, isSaving, error } = useCommunityDataEditor();
  const saveCommunitySettings = async () => {
    const saveError = await save();
    alert(saveError ? saveError.message || 'Error: ' + saveError : t('settings_saved', { communityAddress }));
  };
  const loadingStateString = useStateString(community);

  if (!isReady) {
    return (
      <>
        {loadError?.message && (
          <div className={styles.error}>
            <ErrorDisplay error={loadError} />
          </div>
        )}
        <div className={styles.loading}>{hasFailedToLoad ? t('failed') : <LoadingEllipsis string={loadingStateString || t('loading')} />}</div>
      </>
    );
  }

  return (
    <div className={styles.content}>
      <JsonEditor name='COMMUNITY_DATA_EDITOR' value={text} onChange={setText} readOnly={isSaving} />
      {error && (
        <div className={styles.error}>
          <ErrorDisplay error={error} />
        </div>
      )}
      {isSaving ? (
        <div className={styles.loading}>
          <LoadingEllipsis string={t('saving')} />
        </div>
      ) : (
        <div className={styles.buttons}>
          <Trans
            i18nKey='save_reset_changes'
            components={{
              1: <button key='saveCommunitySettingsButton' onClick={() => void saveCommunitySettings()} />,
              2: <button key='resetCommunitySettingsButton' onClick={reset} />,
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
