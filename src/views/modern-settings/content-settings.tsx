import { useTranslation } from 'react-i18next';
import { useAccount } from '@bitsocial/bitsocial-react-hooks';
import { useDefaultSubscriptions } from '../../hooks/use-default-subscriptions';
import { handleNSFWSubscriptionPrompt } from '../../lib/utils/nsfw-subscription-utils';
import useContentOptionsStore from '../../stores/use-content-options-store';
import { SettingsSection, SettingsSwitch, settingsStyles } from '../../components/modern-settings-section';

/** What the modern interface shows: NSFW media and NSFW default communities. */
const ContentSettings = () => {
  const { t } = useTranslation();
  const account = useAccount();
  const defaultCommunities = useDefaultSubscriptions();
  const blurNsfwThumbnails = useContentOptionsStore((state) => state.blurNsfwThumbnails);
  const setBlurNsfwThumbnails = useContentOptionsStore((state) => state.setBlurNsfwThumbnails);
  const hideNsfwCommunities = useContentOptionsStore((state) => state.hideNsfwCommunities);
  const setHideNsfwCommunities = useContentOptionsStore((state) => state.setHideNsfwCommunities);

  return (
    <>
      <SettingsSection title={t('nsfw_content')}>
        <div className={settingsStyles.rows}>
          <SettingsSwitch id='modern-settings-blur-nsfw' label={t('blur_media')} checked={blurNsfwThumbnails} onChange={setBlurNsfwThumbnails} />
        </div>
      </SettingsSection>
      <SettingsSection title={t('default_communities')}>
        <div className={settingsStyles.rows}>
          <SettingsSwitch
            id='modern-settings-hide-nsfw-communities'
            label={t('hide_communities_tagged_as_nsfw')}
            checked={hideNsfwCommunities}
            onChange={async (hide) => {
              // Showing them again offers to subscribe to the NSFW defaults the account skipped.
              if (!hide) await handleNSFWSubscriptionPrompt({ account, defaultCommunities });
              setHideNsfwCommunities(hide);
            }}
          />
        </div>
      </SettingsSection>
    </>
  );
};

export default ContentSettings;
