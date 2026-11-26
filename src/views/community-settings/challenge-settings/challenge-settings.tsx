import { memo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isCreateCommunityView } from '../../../lib/utils/view-utils';
import {
  EXCLUDE_PUBLICATION_TYPES,
  EXCLUDE_ROLES,
  getExcludeAddresses,
  setExcludeAddresses,
  setExcludeNumber,
  setExcludeRateLimitChallengeSuccess,
  toggleExcludePublicationType,
  toggleExcludeRole,
  type ChallengeExclude,
  type ChallengeSetting,
  type ExcludeNumberField,
} from '../../../lib/utils/challenge-settings-utils';
import { useCommunityChallengesDraft } from '../../../hooks/use-community-settings-draft';
import styles from '../community-settings.module.css';
import { getDisplayAddress } from '../../../lib/utils/address-utils';

type ChallengesDraft = ReturnType<typeof useCommunityChallengesDraft>;

interface ChallengeSettingsProps {
  challenge: ChallengeSetting;
  index: number;
  isReadOnly: boolean;
  draft: ChallengesDraft;
  showSettings: boolean;
  challengesSettings: any;
}

type OptionInput = {
  option: string;
  label: string;
  default?: string;
  description: string;
  placeholder?: string;
  required?: boolean;
};

const ExcludeAddressesFromChallengeInput = ({ exclude, onChange, isReadOnly }: { exclude: ChallengeExclude; onChange: (value: string) => void; isReadOnly: boolean }) => {
  const addresses = getExcludeAddresses(exclude).map((address) => getDisplayAddress(address));
  // the typed text is kept as typed, so commas and spaces survive until the next address
  const [addressInput, setAddressInput] = useState(addresses.join(', '));

  return isReadOnly ? (
    <span>{addresses.join(', ')}</span>
  ) : (
    <input
      type='text'
      placeholder='address1.bso, address2.bso, address3.bso'
      value={addressInput}
      onChange={(e) => {
        setAddressInput(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
};

const ChallengeSettings = ({ challenge, challengesSettings, index, isReadOnly, draft, showSettings }: ChallengeSettingsProps) => {
  const { name, options } = challenge || {};
  const challengeSettings = name ? challengesSettings[name] : undefined;
  const readOnlyFallback = isReadOnly && Object.keys(challengeSettings || {}).length === 0 ? challenge : undefined;

  const excludeArray = Array.isArray(challenge?.exclude) ? challenge.exclude : [];

  const addExcludeGroup = () => {
    draft.addExcludeGroup(index);
    setShowExcludeSettings((oldShowExcludeSettings) => [...oldShowExcludeSettings, true]);
  };

  const [showExcludeSettings, setShowExcludeSettings] = useState<boolean[]>([]);
  const toggleExcludeSettings = (excludeIndex: number) => {
    const newShowExcludeSettings = [...showExcludeSettings];
    newShowExcludeSettings[excludeIndex] = !newShowExcludeSettings[excludeIndex];
    setShowExcludeSettings(newShowExcludeSettings);
  };

  const updateGroup = (excludeIndex: number, update: (exclude: ChallengeExclude) => ChallengeExclude) => draft.updateExcludeGroup(index, excludeIndex, update);
  const handleNumberChange = (excludeIndex: number, field: ExcludeNumberField, value: string) =>
    updateGroup(excludeIndex, (exclude) => setExcludeNumber(exclude, field, value === '' ? undefined : Number(value)));

  return (
    <div className={showSettings || isReadOnly ? styles.visible : styles.hidden}>
      {isReadOnly ? (
        <>
          <div className={styles.readOnlyChallengeType}>type: {(challengeSettings?.type || readOnlyFallback?.type) ?? 'unknown'}</div>
          <div className={styles.readOnlyChallengeDescription}>{challengeSettings?.description || readOnlyFallback?.description || ''}</div>
        </>
      ) : (
        <div className={styles.challengeDescription}>{challengeSettings?.description}</div>
      )}
      {challengeSettings?.optionInputs?.map((setting: OptionInput) => (
        <div key={setting?.option} className={styles.challengeOption}>
          <div className={styles.challengeOptionLabel}>{setting?.label}</div>
          <div className={styles.challengeOptionDescription}>
            {setting?.description} {setting?.default && `(default: "${setting?.default}")`}
          </div>
          {isReadOnly ? (
            <span>{options && (options[setting?.option] || '')}</span>
          ) : (
            <input
              type='text'
              value={options && (options[setting?.option] || '')}
              placeholder={setting?.placeholder || ''}
              onChange={(e) => draft.setChallengeOption(index, setting?.option, e.target.value)}
            />
          )}
        </div>
      ))}
      <div className={styles.challengeDescription}>Exclude groups for challenge #{index + 1}</div>
      <div className={styles.excludeGroupSection}>
        {!isReadOnly && (
          <button className={`${styles.addButton} ${styles.addExclude}`} onClick={addExcludeGroup} disabled={isReadOnly}>
            Add Group
          </button>
        )}
        {excludeArray.map((exclude, excludeIndex) => (
          <div key={excludeIndex} className={styles.excludeGroup}>
            Exclude group #{excludeIndex + 1}
            {!isReadOnly && <span className={styles.deleteButton} onClick={() => draft.removeExcludeGroup(index, excludeIndex)} title='delete group' />}
            {!isReadOnly && (
              <button className={styles.hideCombo} onClick={() => toggleExcludeSettings(excludeIndex)} disabled={isReadOnly}>
                {(showExcludeSettings?.[excludeIndex] ?? false) ? 'Hide' : 'Show'} Group Settings
              </button>
            )}
            {showExcludeSettings[excludeIndex] && (
              <>
                {isReadOnly && getExcludeAddresses(exclude).length === 0 ? null : (
                  <div className={styles.challengeOption}>
                    User's address
                    <div className={styles.challengeOptionDescription}>Is one of the following:</div>
                    <ExcludeAddressesFromChallengeInput
                      exclude={exclude}
                      onChange={(value) => updateGroup(excludeIndex, (current) => setExcludeAddresses(current, value))}
                      isReadOnly={isReadOnly}
                    />
                  </div>
                )}
                {isReadOnly && !(exclude?.postScore || exclude?.replyScore) ? null : (
                  <div className={styles.challengeOption}>
                    User's karma
                    {isReadOnly && !exclude?.postScore ? null : (
                      <>
                        <div className={styles.challengeOptionDescription}>Post karma is at least:</div>
                        {isReadOnly ? (
                          <span>{exclude?.postScore}</span>
                        ) : (
                          <input type='number' min={0} value={exclude?.postScore ?? ''} onChange={(e) => handleNumberChange(excludeIndex, 'postScore', e.target.value)} />
                        )}
                      </>
                    )}
                    {isReadOnly && !exclude?.replyScore ? null : (
                      <>
                        <div className={styles.challengeOptionDescription}>Comment karma is at least:</div>
                        {isReadOnly ? (
                          <span>{exclude?.replyScore}</span>
                        ) : (
                          <input
                            min={0}
                            type='number'
                            value={exclude?.replyScore ?? ''}
                            onChange={(e) => handleNumberChange(excludeIndex, 'replyScore', e.target.value)}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
                {isReadOnly && !exclude?.firstCommentTimestamp ? null : (
                  <div className={styles.challengeOption}>
                    User's account age
                    <div className={styles.challengeOptionDescription}>In seconds (eg. 86400 = 24h) is at least:</div>
                    {isReadOnly ? (
                      <span>{exclude?.firstCommentTimestamp}</span>
                    ) : (
                      <input
                        type='number'
                        min={0}
                        value={exclude?.firstCommentTimestamp ?? ''}
                        onChange={(e) => handleNumberChange(excludeIndex, 'firstCommentTimestamp', e.target.value)}
                      />
                    )}
                  </div>
                )}
                {isReadOnly && !exclude?.roles?.length ? null : (
                  <div className={styles.challengeOption}>
                    User's role
                    <div className={styles.challengeOptionDescription}>Is any of the following:</div>
                    {EXCLUDE_ROLES.map((role) =>
                      isReadOnly && !exclude?.roles?.includes(role) ? null : (
                        <div key={role}>
                          {isReadOnly ? (
                            <span className={styles.readOnlyRoleExclude}>{role} excluded</span>
                          ) : (
                            <label>
                              <input
                                type='checkbox'
                                checked={Boolean(exclude?.roles?.includes(role))}
                                onChange={() => updateGroup(excludeIndex, (current) => toggleExcludeRole(current, role))}
                              />
                              is {role}
                            </label>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                )}
                {isReadOnly && !EXCLUDE_PUBLICATION_TYPES.some((type) => exclude?.publicationType?.[type]) ? null : (
                  <div className={styles.challengeOption}>
                    User's action
                    <div className={styles.challengeOptionDescription}>Is any of the following:</div>
                    {EXCLUDE_PUBLICATION_TYPES.map((type) =>
                      isReadOnly && !exclude?.publicationType?.[type] ? null : (
                        <div key={type}>
                          {isReadOnly ? (
                            <span className={styles.readOnlyActionExclude}>{type} excluded</span>
                          ) : (
                            <label>
                              <input
                                type='checkbox'
                                checked={Boolean(exclude?.publicationType?.[type])}
                                onChange={() => updateGroup(excludeIndex, (current) => toggleExcludePublicationType(current, type))}
                              />
                              is {type}
                            </label>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                )}
                {isReadOnly && !exclude?.rateLimit ? null : (
                  <div className={styles.challengeOption}>
                    Rate limit
                    <div className={styles.challengeOptionDescription}>Number of free user actions per hour:</div>
                    {isReadOnly ? (
                      <div>{exclude?.rateLimit}</div>
                    ) : (
                      <input type='number' min={0} value={exclude?.rateLimit ?? ''} onChange={(e) => handleNumberChange(excludeIndex, 'rateLimit', e.target.value)} />
                    )}
                    {isReadOnly && !exclude?.rateLimitChallengeSuccess ? null : (
                      <div>
                        <label>
                          <input
                            type='checkbox'
                            checked={exclude?.rateLimitChallengeSuccess === true}
                            onChange={(e) => updateGroup(excludeIndex, (current) => setExcludeRateLimitChallengeSuccess(current, e.target.checked ? true : undefined))}
                            disabled={isReadOnly}
                          />
                          apply rate limit only on challenge success
                        </label>
                        <label className={styles.rateLimitChallengeFail}>
                          <input
                            type='checkbox'
                            checked={exclude?.rateLimitChallengeSuccess === false}
                            onChange={(e) => updateGroup(excludeIndex, (current) => setExcludeRateLimitChallengeSuccess(current, e.target.checked ? false : undefined))}
                            disabled={isReadOnly}
                          />
                          apply rate limit only on challenge fail
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const Challenges = memo(function Challenges({
  isReadOnly,
  readOnlyChallenges,
  challengeNames,
  challengesSettings,
}: {
  isReadOnly: boolean;
  readOnlyChallenges: ChallengeSetting[] | undefined;
  challengeNames: string[];
  challengesSettings: any;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const isInCreateCommunityView = isCreateCommunityView(location.pathname);
  const draft = useCommunityChallengesDraft(readOnlyChallenges);
  const { challenges } = draft;
  const [showSettings, setShowSettings] = useState<boolean[]>(challenges?.map(() => false));

  const toggleSettings = (index: number) => {
    const newShowSettings = [...showSettings];
    newShowSettings[index] = !newShowSettings[index];
    setShowSettings(newShowSettings);
  };

  const handleAddChallenge = () => {
    draft.addChallenge();
    setShowSettings((oldShowSettings) => [...oldShowSettings, true]);
  };

  const handleDeleteChallenge = (index: number) => {
    draft.removeChallenge(index);
    setShowSettings((oldShowSettings) => oldShowSettings.filter((_, idx) => idx !== index));
  };

  return (
    <div className={`${styles.box} ${isReadOnly && !challenges ? styles.hidden : styles.visible}`}>
      <div className={styles.boxTitle}>{t('challenges')}</div>
      <div className={styles.boxSubtitle}>{t('challenges_subtitle')}</div>
      <div className={styles.boxInput}>
        {!isReadOnly && (
          <button className={styles.addButton} onClick={handleAddChallenge} disabled={isReadOnly}>
            {t('add_a_challenge')}
          </button>
        )}
        {challenges.length === 0 && !isInCreateCommunityView && <span className={styles.noChallengeWarning}>{t('warning_spam')}</span>}
        {challenges?.map((challenge, index) => (
          <div key={index} className={styles.challenge}>
            Challenge #{index + 1}
            {!isReadOnly && <span className={styles.deleteButton} title='delete challenge' onClick={() => (isReadOnly ? {} : handleDeleteChallenge(index))} />}
            <br />
            {isReadOnly ? (
              <span className={styles.readOnlyChallenge}>{challenge?.name}</span>
            ) : (
              <select value={challenge?.name} onChange={(e) => draft.setChallengeName(index, e.target.value)} disabled={isReadOnly}>
                {challengeNames?.map((challenge) => (
                  <option key={challenge} value={challenge}>
                    {challenge}
                  </option>
                ))}
              </select>
            )}
            {!isReadOnly && (
              <button className={styles.challengeEditButton} onClick={() => toggleSettings(index)} disabled={isReadOnly}>
                {showSettings[index] ? t('hide_settings') : t('show_settings')}
              </button>
            )}
            <ChallengeSettings
              challenge={challenge}
              challengesSettings={challengesSettings || {}}
              index={index}
              isReadOnly={isReadOnly}
              draft={draft}
              showSettings={showSettings[index]}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

export default Challenges;
