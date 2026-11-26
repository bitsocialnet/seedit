import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import type { Role } from '@bitsocial/bitsocial-react-hooks';
import useCommunitySettings from '../../hooks/use-community-settings';
import { useCommunityModeratorsDraft, useCommunityRulesDraft } from '../../hooks/use-community-settings-draft';
import useIsCommunityOffline from '../../hooks/use-is-community-offline';
import useStateString from '../../hooks/use-state-string';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import useCommunitySettingsStore from '../../stores/use-community-settings-store';
import CommunityReachabilityAlert from '../../components/community-reachability-alert';
import Markdown from '../../components/markdown';
import { CloseIcon, ExternalLinkIcon, PlusIcon } from '../../components/modern-icons';
import { ModernColumns, modernStyles } from '../../components/modern-layout';
import { SettingsSection, settingsStyles } from '../../components/modern-settings-section';
import ChallengeEditor from './challenge-editor';
import styles from './modern-community-settings.module.css';

const RELEASES_URL = 'https://github.com/bitsocialnet/seedit/releases/latest';
const MODERATOR_ROLES: Role['role'][] = ['moderator', 'admin', 'owner'];

const capitalize = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

// Each field reads its own part of the draft, so typing in one leaves the others alone.

const TitleField = ({ isReadOnly }: { isReadOnly: boolean }) => {
  const { t } = useTranslation();
  const title = useCommunitySettingsStore((state) => state.title);
  const setDraft = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);
  if (isReadOnly && !title) return null;

  return (
    <SettingsSection id='title' title={t('title')} description={t('a_short_title')}>
      {isReadOnly ? (
        <p className={styles.value}>{title}</p>
      ) : (
        <input
          className={`${settingsStyles.input} ${styles.fullWidth}`}
          aria-labelledby='title-title'
          value={title ?? ''}
          maxLength={100}
          onChange={(event) => setDraft({ title: event.target.value })}
        />
      )}
    </SettingsSection>
  );
};

const DescriptionField = ({ isReadOnly }: { isReadOnly: boolean }) => {
  const { t } = useTranslation();
  const description = useCommunitySettingsStore((state) => state.description);
  const setDraft = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const showPreview = isReadOnly || (isPreviewing && Boolean(description));
  if (isReadOnly && !description) return null;

  return (
    <SettingsSection id='description' title={t('description')} description={t('shown_in_sidebar')}>
      {!isReadOnly && (
        <div className={styles.toolbar}>
          <button type='button' className={styles.toggle} aria-pressed={showPreview} disabled={!description} onClick={() => setIsPreviewing(!isPreviewing)}>
            <span className={modernStyles.sentenceCase}>{t('preview')}</span>
          </button>
        </div>
      )}
      {showPreview ? (
        <div className={isReadOnly ? styles.value : styles.preview}>
          <Markdown content={description ?? ''} />
        </div>
      ) : (
        <textarea
          className={`${settingsStyles.textarea} ${styles.prose}`}
          aria-labelledby='description-title'
          value={description ?? ''}
          onChange={(event) => setDraft({ description: event.target.value })}
        />
      )}
    </SettingsSection>
  );
};

const AddressField = ({ isReadOnly, publicKey }: { isReadOnly: boolean; publicKey: string | undefined }) => {
  const { t } = useTranslation();
  const address = useCommunitySettingsStore((state) => state.address);
  const setDraft = useCommunitySettingsStore((state) => state.setCommunitySettingsStore);

  return (
    <SettingsSection id='address' title={t('address')} description={t('address_setting_info')}>
      {isReadOnly ? (
        <p className={`${styles.value} ${settingsStyles.mono}`}>{getDisplayAddress(address)}</p>
      ) : (
        <>
          <input
            className={`${settingsStyles.input} ${styles.fullWidth}`}
            aria-labelledby='address-title'
            value={getDisplayAddress(address)}
            autoCapitalize='off'
            autoCorrect='off'
            spellCheck={false}
            onChange={(event) => setDraft({ address: event.target.value })}
          />
          <details className={styles.help}>
            <summary>How to use a .bso address</summary>A <code>.bso</code> address is an ENS name you own, shown by Seedit with a <code>.bso</code> ending instead of{' '}
            <code>.eth</code>.
            <ol>
              <li>
                Register a name (e.g. <code>yourcommunity.eth</code>) at{' '}
                <a className={settingsStyles.link} href='https://app.ens.domains/' target='_blank' rel='noopener noreferrer'>
                  app.ens.domains
                </a>
                .
              </li>
              <li>
                Open that name on ENS and go to <strong>Records</strong> → <strong>Edit Records</strong>.
              </li>
              <li>
                Add a <strong>text record</strong> named <code>bitsocial</code> with this community&apos;s public key as its value: <code>{publicKey || address}</code>
              </li>
              <li>
                Enter the matching <code>.bso</code> name (e.g. <code>yourcommunity.bso</code>) above and save.
              </li>
            </ol>
          </details>
        </>
      )}
    </SettingsSection>
  );
};

const RulesEditor = ({ isReadOnly }: { isReadOnly: boolean }) => {
  const { t } = useTranslation();
  const { rules, addRule, setRule, removeRule } = useCommunityRulesDraft();
  // the rule just added takes focus once it renders
  const focusNewRule = useRef(false);
  if (isReadOnly && !rules?.length) return null;

  return (
    <SettingsSection id='rules' title={t('rules')} description={t('shown_in_sidebar')}>
      {isReadOnly ? (
        <ol className={styles.readOnlyList}>
          {rules?.map((rule, index) => (
            <li key={index}>{rule}</li>
          ))}
        </ol>
      ) : (
        <>
          <ol className={styles.list}>
            {rules?.map((rule, index) => (
              <li key={index} className={styles.listRow}>
                <span className={styles.listNumber} aria-hidden='true'>
                  {index + 1}.
                </span>
                <input
                  ref={(node) => {
                    if (node && focusNewRule.current && index === rules.length - 1) {
                      node.focus();
                      focusNewRule.current = false;
                    }
                  }}
                  className={settingsStyles.input}
                  aria-label={`Rule ${index + 1}`}
                  value={rule}
                  onChange={(event) => setRule(index, event.target.value)}
                />
                <button type='button' className={styles.iconButton} aria-label={`Remove rule ${index + 1}`} onClick={() => removeRule(index)}>
                  <CloseIcon size={16} />
                </button>
              </li>
            ))}
          </ol>
          <button
            type='button'
            className={`${modernStyles.secondaryButton} ${settingsStyles.button}`}
            onClick={() => {
              focusNewRule.current = true;
              addRule();
            }}
          >
            <PlusIcon size={16} />
            <span className={modernStyles.sentenceCase}>{t('add_rule')}</span>
          </button>
        </>
      )}
    </SettingsSection>
  );
};

const ModeratorsEditor = ({ isReadOnly }: { isReadOnly: boolean }) => {
  const { t } = useTranslation();
  const { roles, addModerator, setModeratorAddress, setModeratorRole, removeModerator } = useCommunityModeratorsDraft();
  const moderators = Object.entries(roles ?? {});
  const focusNewModerator = useRef(false);
  if (isReadOnly && moderators.length === 0) return null;

  return (
    <SettingsSection id='moderators' title={t('moderators')} description={t('moderators_setting_info')}>
      {isReadOnly ? (
        <ul className={styles.readOnlyList}>
          {moderators.map(([address, { role }]) => (
            <li key={address} className={styles.moderator}>
              {/* Author pages need a comment to open from, so a moderator is shown without a link, as in the community rail. */}
              <span className={settingsStyles.mono} title={address}>
                u/{getDisplayAddress(address)}
              </span>
              <span className={styles.badge}>{role}</span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className={styles.list}>
            {moderators.map(([address, { role }], index) => (
              <li key={index} className={styles.listRow}>
                <input
                  ref={(node) => {
                    if (node && focusNewModerator.current && index === moderators.length - 1) {
                      node.focus();
                      focusNewModerator.current = false;
                    }
                  }}
                  className={settingsStyles.input}
                  aria-label={`Moderator ${index + 1} address`}
                  placeholder='u/address.bso'
                  value={getDisplayAddress(address)}
                  autoCapitalize='off'
                  autoCorrect='off'
                  spellCheck={false}
                  onChange={(event) => setModeratorAddress(index, event.target.value)}
                />
                <select
                  className={settingsStyles.select}
                  aria-label={`Moderator ${index + 1} role`}
                  value={role}
                  onChange={(event) => setModeratorRole(address, event.target.value as Role['role'])}
                >
                  {MODERATOR_ROLES.map((moderatorRole) => (
                    <option key={moderatorRole} value={moderatorRole}>
                      {moderatorRole}
                    </option>
                  ))}
                </select>
                <button type='button' className={styles.iconButton} aria-label={`Remove moderator ${index + 1}`} onClick={() => removeModerator(address)}>
                  <CloseIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
          <button
            type='button'
            className={`${modernStyles.secondaryButton} ${settingsStyles.button}`}
            onClick={() => {
              focusNewModerator.current = true;
              addModerator();
            }}
          >
            <PlusIcon size={16} />
            <span className={modernStyles.sentenceCase}>{t('add_moderator')}</span>
          </button>
        </>
      )}
    </SettingsSection>
  );
};

/** Creating a community needs a full node, which the browser does not run; the desktop app does. */
const CreateNeedsFullNode = () => {
  const { t } = useTranslation();
  const [explanation] = t('create_community_warning').split('\n\n');
  return (
    <div className={settingsStyles.sections}>
      <SettingsSection title={t('create_community')}>
        <p className={styles.prose}>{explanation}</p>
        <a className={`${modernStyles.primaryButton} ${styles.download}`} href={RELEASES_URL} target='_blank' rel='noopener noreferrer'>
          Download Seedit desktop
          <ExternalLinkIcon size={16} />
        </a>
      </SettingsSection>
    </div>
  );
};

/**
 * A community's settings, or a new community's, in the modern interface. Visitors see what the community publishes;
 * owners and admins edit it, and only the node that runs it can read and change its challenges.
 */
const ModernCommunitySettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    community,
    communityAddress,
    hasLoaded,
    isCreating,
    isConnectedToRpc,
    isHostedHere,
    isOwnerOrAdmin,
    isReadOnly,
    isChallengesReadOnly,
    challengeNames,
    challengesSettings,
    isSaving,
    isDeleting,
    error,
    save,
    create,
    remove,
  } = useCommunitySettings();
  const { isOffline, offlineTitle } = useIsCommunityOffline(community || {});
  const loadingState = useStateString(community);

  // "Saved" shows until the draft changes again.
  const publishOptions = useCommunitySettingsStore((state) => state.publishCommunityEditOptions);
  const [savedOptions, setSavedOptions] = useState<unknown>();
  const isSaved = savedOptions === publishOptions && !error && !isSaving;

  const heading = capitalize(t(isCreating ? 'create_community' : 'community_settings', { interpolation: { escapeValue: false } }).toLowerCase());
  useEffect(() => {
    document.title = `${heading} - Seedit`;
  }, [heading]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [communityAddress, isCreating]);

  const displayAddress = getDisplayAddress(community?.shortAddress || communityAddress);
  const header = (
    <header className={settingsStyles.header}>
      <h1 className={settingsStyles.heading}>{heading}</h1>
      {!isCreating && communityAddress && (
        <Link to={getCommunityPath(communityAddress)} className={styles.subheading}>
          s/{displayAddress}
        </Link>
      )}
    </header>
  );

  if (isCreating && !isConnectedToRpc) {
    return (
      <ModernColumns>
        {header}
        <CreateNeedsFullNode />
      </ModernColumns>
    );
  }

  if (!isCreating && !hasLoaded) {
    return (
      <ModernColumns>
        {header}
        <p className={`${settingsStyles.status} ${styles.loading}`} role='status'>
          {community?.error?.message ? <span className={settingsStyles.statusError}>{community.error.message}</span> : loadingState || `${t('loading')}…`}
        </p>
      </ModernColumns>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreating) {
      await create();
    } else if (await save()) {
      setSavedOptions(publishOptions);
    }
  };

  const handleDelete = async () => {
    if (await remove()) navigate('/', { replace: true });
  };

  return (
    <ModernColumns>
      {header}
      {isReadOnly && !isOwnerOrAdmin && <p className={settingsStyles.notice}>{t('owner_settings_notice')}</p>}
      {!isCreating && isOffline && <p className={settingsStyles.notice}>{offlineTitle}</p>}
      {!isCreating && <CommunityReachabilityAlert className={settingsStyles.notice} isHostedHere={isHostedHere} />}
      <form className={settingsStyles.sections} onSubmit={handleSubmit}>
        <TitleField isReadOnly={isReadOnly} />
        <DescriptionField isReadOnly={isReadOnly} />
        {!isCreating && <AddressField isReadOnly={isReadOnly} publicKey={community?.publicKey} />}
        <RulesEditor isReadOnly={isReadOnly} />
        <ModeratorsEditor isReadOnly={isReadOnly} />
        <ChallengeEditor
          publishedChallenges={community?.challenges}
          challengeNames={challengeNames}
          challengesSettings={challengesSettings}
          isReadOnly={isChallengesReadOnly}
          isCreating={isCreating}
        />
        {!isCreating && !isReadOnly && communityAddress && (
          <SettingsSection id='json' title={t('json_settings')} description={t('json_settings_info')}>
            <Link
              to={`${getCommunityPath(communityAddress)}/settings/editor`}
              className={`${modernStyles.secondaryButton} ${settingsStyles.button} ${styles.fitContent}`}
            >
              <span className={modernStyles.sentenceCase}>{t('edit')}</span>
            </Link>
          </SettingsSection>
        )}
        {!isCreating && !isReadOnly && (
          <SettingsSection id='delete' title={t('delete_community')} description={t('delete_community_description')}>
            <button
              type='button'
              className={`${modernStyles.secondaryButton} ${settingsStyles.button} ${settingsStyles.danger} ${styles.fitContent}`}
              disabled={isDeleting || isSaving}
              onClick={() => void handleDelete()}
            >
              <span className={modernStyles.sentenceCase}>{isDeleting ? `${t('deleting')}…` : t('delete_community')}</span>
            </button>
          </SettingsSection>
        )}
        {!isReadOnly && (
          <div className={styles.saveBar}>
            <p className={settingsStyles.status} role='status'>
              {error ? (
                <span className={settingsStyles.statusError}>{error.message}</span>
              ) : isSaving ? (
                `${t('saving')}…`
              ) : isSaved ? (
                <span className={settingsStyles.statusSuccess}>{t('settings_saved', { communityAddress: displayAddress })}</span>
              ) : null}
            </p>
            <button type='submit' className={modernStyles.primaryButton} disabled={isSaving || isDeleting}>
              <span className={modernStyles.sentenceCase}>{isCreating ? t('create_community') : t('save_options')}</span>
            </button>
          </div>
        )}
      </form>
    </ModernColumns>
  );
};

export default ModernCommunitySettings;
