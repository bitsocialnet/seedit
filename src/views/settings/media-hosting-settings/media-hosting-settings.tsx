import { useTranslation } from 'react-i18next';
import { getMediaHostingRuntime, getRuntimeProviders, resolveUploadSettings } from '../../../lib/media-hosting';
import { useProviderAvailability } from '../../../hooks/use-provider-availability';
import useMediaHostingStore from '../../../stores/use-media-hosting-store';
import styles from './media-hosting-settings.module.css';

const RADIO_NAME = 'mediaHostingProvider';

const MediaHostingSettings = () => {
  const { t } = useTranslation();
  const storedUploadMode = useMediaHostingStore((state) => state.uploadMode);
  const storedPreferredProvider = useMediaHostingStore((state) => state.preferredProvider);
  const setUploadMode = useMediaHostingStore((state) => state.setUploadMode);
  const setPreferredProvider = useMediaHostingStore((state) => state.setPreferredProvider);
  const runtime = getMediaHostingRuntime();
  // Only the providers this runtime can upload to: the web app has no CORS-free route to the others.
  const providers = getRuntimeProviders(runtime);
  const { mode, preferredProvider } = resolveUploadSettings({ mode: storedUploadMode, preferredProvider: storedPreferredProvider, runtime });
  const availability = useProviderAvailability(runtime);

  return (
    <div className={styles.mediaHostingSettings} role='radiogroup' aria-label={t('media_hosting_providers')}>
      {providers.length > 1 && (
        <div>
          <label>
            <input type='radio' name={RADIO_NAME} value='random' checked={mode === 'random'} onChange={() => setUploadMode('random')} />
            {t('media_hosting_random')}
          </label>
        </div>
      )}
      {providers.map((provider) => {
        const unavailable = availability[provider.id] === 'unavailable';
        return (
          <div key={provider.id}>
            <label>
              <input
                type='radio'
                name={RADIO_NAME}
                value={provider.id}
                checked={mode === 'preferred' && preferredProvider === provider.id}
                disabled={unavailable}
                onChange={() => {
                  setPreferredProvider(provider.id);
                  setUploadMode('preferred');
                }}
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
          <input type='radio' name={RADIO_NAME} value='none' checked={mode === 'none'} onChange={() => setUploadMode('none')} />
          {t('media_hosting_none')}
        </label>
        <span className={styles.info}>{t('media_hosting_none_tip')}</span>
      </div>
      {runtime === 'web' && <div className={styles.tip}>{t('media_hosting_more_providers_in_apps')}</div>}
    </div>
  );
};

export default MediaHostingSettings;
