import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Community } from '@bitsocial/bitsocial-react-hooks';
import useCommunitySubscription from '../../hooks/use-community-subscription';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import type { SeeditDirectoryCode } from '../../lib/utils/directory-codes';
import { getFormattedTimeDuration } from '../../lib/utils/time-utils';
import Markdown from '../markdown';
import ModernCommunityAvatar from '../modern-community-avatar';
import { ModernRailSection, modernStyles } from '../modern-layout';
import styles from './modern-community-about.module.css';

interface ModernJoinButtonProps {
  address: string;
  directoryCode?: SeeditDirectoryCode;
  directoryRevision?: number;
}

export const ModernJoinButton = ({ address, directoryCode, directoryRevision }: ModernJoinButtonProps) => {
  const { t } = useTranslation();
  const { subscribed, toggleSubscription } = useCommunitySubscription({ address, directoryCode, directoryRevision });
  if (subscribed === undefined) return null;

  return (
    <button
      type='button'
      className={subscribed ? modernStyles.secondaryButton : modernStyles.primaryButton}
      aria-pressed={subscribed}
      onClick={() => void toggleSubscription()}
    >
      <span className={modernStyles.sentenceCase}>{subscribed ? t('leave') : t('join')}</span>
    </button>
  );
};

interface ModernCommunityAboutProps {
  community: Community | undefined;
  communityAddress: string;
  /** Outside the community's own page, the rail leads with the community's identity, a link to it, and a join button. */
  showIdentity?: boolean;
}

/** The right rail about a community: description, address, age, rules, and moderators. */
const ModernCommunityAbout = ({ community, communityAddress, showIdentity }: ModernCommunityAboutProps) => {
  const { t } = useTranslation();
  const { createdAt, description, roles, rules, title } = community || {};
  const moderators = Object.entries(roles || {}) as [string, { role?: string }][];
  const displayAddress = getDisplayAddress(community?.shortAddress || communityAddress);

  return (
    <>
      <ModernRailSection title={showIdentity ? undefined : title || `s/${displayAddress}`}>
        {showIdentity && (
          <div className={styles.identity}>
            <Link to={getCommunityPath(communityAddress)} className={styles.identityLink} title={communityAddress}>
              <ModernCommunityAvatar address={communityAddress} avatarUrl={community?.suggested?.avatarUrl} size='medium' />
              <span className={styles.identityText}>
                <span className={styles.identityTitle}>{title || `s/${displayAddress}`}</span>
                {title && <span className={styles.identityAddress}>s/{displayAddress}</span>}
              </span>
            </Link>
            <ModernJoinButton address={communityAddress} />
          </div>
        )}
        {description && (
          <div className={styles.description}>
            <Markdown content={description} />
          </div>
        )}
        <dl className={styles.facts}>
          <div>
            <dt>{t('address')}</dt>
            <dd className={styles.address}>{communityAddress}</dd>
          </div>
        </dl>
        {createdAt && <p className={styles.age}>{t('community_for', { date: getFormattedTimeDuration(createdAt) })}</p>}
        <Link to={`${getCommunityPath(communityAddress)}/settings`} className={styles.settingsLink}>
          {t('community_settings')}
        </Link>
      </ModernRailSection>
      {rules && rules.length > 0 && (
        <ModernRailSection title={t('rules')}>
          <ol className={styles.rules}>
            {rules.map((rule: string, index: number) => (
              <li key={index}>{rule}</li>
            ))}
          </ol>
        </ModernRailSection>
      )}
      {moderators.length > 0 && (
        <ModernRailSection title={<span className={modernStyles.sentenceCase}>{t('moderators')}</span>}>
          <ul className={styles.moderators}>
            {moderators.map(([address, { role }]) => (
              <li key={address}>
                {/* Author pages need a comment to open from, so a moderator is shown without a link, as in the old sidebar. */}
                <span className={styles.moderator} title={address}>
                  u/{getDisplayAddress(address)}
                </span>
                {role && <span className={styles.role}>{role}</span>}
              </li>
            ))}
          </ul>
        </ModernRailSection>
      )}
    </>
  );
};

export default ModernCommunityAbout;
