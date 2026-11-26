import { useTranslation } from 'react-i18next';
import useMediaHostingOptions from '../../../hooks/use-media-hosting-options';
import styles from './media-hosting-settings.module.css';

const RADIO_NAME = 'mediaHostingProvider';

const MediaHostingSettings = () => {
  const { t } = useTranslation();
  const { runtime, providers, mode, preferredProvider, isUnavailable, isSelectable, selectRandom, selectNone, selectProvider } = useMediaHostingOptions();

  return (
    <div className={styles.mediaHostingSettings} role='radiogroup' aria-label={t('media_hosting_providers')}>
      {providers.length > 1 && (
        <div>
          <label>
            <input type='radio' name={RADIO_NAME} value='random' checked={mode === 'random'} onChange={selectRandom} />
            {t('media_hosting_random')}
          </label>
        </div>
      )}
      {providers.map((provider) => {
        const unavailable = isUnavailable(provider.id);
        return (
          <div key={provider.id}>
            <label>
              <input
                type='radio'
                name={RADIO_NAME}
                value={provider.id}
                checked={mode === 'preferred' && preferredProvider === provider.id}
                disabled={!isSelectable(provider.id)}
                onChange={() => selectProvider(provider.id)}
              />
              <span className={styles.providerLabel}>{provider.label}</span>
            </label>
            <a className={styles.providerLink} href={provider.homepageUrl} target='_blank' rel='noopener noreferrer'>
              {new URL(provider.homepageUrl).host}
            </a>
            <span className={styles.info}>{unavailable ? t('media_hosting_provider_unavailable') : provider.fileKinds.join('/')}</span>
          </div>
        );
      })}
      <div>
        <label>
          <input type='radio' name={RADIO_NAME} value='none' checked={mode === 'none'} onChange={selectNone} />
          {t('media_hosting_none')}
        </label>
        <span className={styles.info}>{t('media_hosting_none_tip')}</span>
      </div>
      {runtime === 'web' && <div className={styles.tip}>{t('media_hosting_more_providers_in_apps')}</div>}
    </div>
  );
};

export default MediaHostingSettings;
