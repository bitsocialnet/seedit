import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCommunityChallengesDraft } from '../../hooks/use-community-settings-draft';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import {
  EXCLUDE_PUBLICATION_TYPES,
  EXCLUDE_ROLES,
  getExcludeAddresses,
  parseExcludeAddresses,
  setExcludeAddresses,
  setExcludeNumber,
  setExcludeRateLimitChallengeSuccess,
  toggleExcludeChallenge,
  toggleExcludePublicationType,
  toggleExcludeRole,
  type ChallengeExclude,
  type ExcludePublicationType,
  type ChallengeSetting,
  type ExcludeNumberField,
} from '../../lib/utils/challenge-settings-utils';
import { CloseIcon, PlusIcon } from '../../components/modern-icons';
import { modernStyles } from '../../components/modern-layout';
import { SettingsSection, settingsStyles } from '../../components/modern-settings-section';
import styles from './modern-community-settings.module.css';

type ChallengesDraft = ReturnType<typeof useCommunityChallengesDraft>;

interface OptionInput {
  option: string;
  label: string;
  default?: string;
  description?: string;
  placeholder?: string;
}

interface ChallengeInfo {
  type?: string;
  description?: string;
  optionInputs?: OptionInput[];
}

const NUMBER_FIELDS: { field: ExcludeNumberField; label: string; hint?: string }[] = [
  { field: 'postScore', label: 'Post karma of at least' },
  { field: 'replyScore', label: 'Comment karma of at least' },
  { field: 'firstCommentTimestamp', label: 'Account age of at least', hint: 'seconds; 86400 is a day' },
  { field: 'rateLimit', label: 'Free actions per hour', hint: 'once used up, the challenge applies again' },
];

const PUBLICATION_TYPE_LABELS: Record<ExcludePublicationType, string> = {
  post: 'post',
  reply: 'reply',
  vote: 'vote',
  commentEdit: 'comment edit',
  commentModeration: 'moderation',
  communityEdit: 'community edit',
};

const RATE_LIMIT_MODES = [
  { value: undefined, label: 'Every action' },
  { value: true, label: 'Only actions that pass the challenge' },
  { value: false, label: 'Only actions that fail the challenge' },
] as const;

const isSameAddressList = (a: string[], b: string[]) => [...a].sort().join(',') === [...b].sort().join(',');

/**
 * Comma-separated author addresses. The typed text shows while it still parses to the stored addresses, so a trailing
 * comma or space survives; once the group holds other addresses, as after an earlier group is removed, those show.
 */
const AddressesInput = ({ id, exclude, onChange }: { id: string; exclude: ChallengeExclude; onChange: (text: string) => void }) => {
  const stored = getExcludeAddresses(exclude);
  const [typed, setTyped] = useState<string>();
  const value = typed !== undefined && isSameAddressList(parseExcludeAddresses(typed), stored) ? typed : stored.map(getDisplayAddress).join(', ');
  return (
    <input
      id={id}
      className={settingsStyles.input}
      value={value}
      placeholder='alice.bso, 12D3KooW…'
      autoCapitalize='off'
      autoCorrect='off'
      spellCheck={false}
      onChange={(event) => {
        setTyped(event.target.value);
        onChange(event.target.value);
      }}
    />
  );
};

/** One group of authors the challenge skips; an author must match everything the group sets. */
const ExcludeGroup = ({
  id,
  index,
  challengeIndex,
  challengeCount,
  exclude,
  onChange,
  onRemove,
}: {
  id: string;
  index: number;
  /** The challenge this group belongs to, which the group cannot name, and how many challenges there are. */
  challengeIndex: number;
  challengeCount: number;
  exclude: ChallengeExclude;
  onChange: (update: (exclude: ChallengeExclude) => ChallengeExclude) => void;
  onRemove: () => void;
}) => (
  <fieldset className={styles.group}>
    <legend className={styles.groupLegend}>Group {index + 1}</legend>
    <button type='button' className={styles.iconButton} aria-label={`Remove group ${index + 1}`} onClick={onRemove}>
      <CloseIcon size={16} />
    </button>
    <label className={settingsStyles.field} htmlFor={`${id}-addresses`}>
      Author is one of
      <AddressesInput id={`${id}-addresses`} exclude={exclude} onChange={(text) => onChange((current) => setExcludeAddresses(current, text))} />
    </label>
    <div className={settingsStyles.field}>
      <span id={`${id}-roles`}>Author is a</span>
      <div className={styles.chips} role='group' aria-labelledby={`${id}-roles`}>
        {EXCLUDE_ROLES.map((role) => (
          <label key={role} className={styles.chip}>
            <input type='checkbox' checked={Boolean(exclude.roles?.includes(role))} onChange={() => onChange((current) => toggleExcludeRole(current, role))} />
            {role}
          </label>
        ))}
      </div>
    </div>
    <div className={settingsStyles.field}>
      <span id={`${id}-types`}>Author is publishing a</span>
      <div className={styles.chips} role='group' aria-labelledby={`${id}-types`}>
        {EXCLUDE_PUBLICATION_TYPES.map((type) => (
          <label key={type} className={styles.chip}>
            <input
              type='checkbox'
              checked={Boolean(exclude.publicationType?.[type])}
              onChange={() => onChange((current) => toggleExcludePublicationType(current, type))}
            />
            {PUBLICATION_TYPE_LABELS[type]}
          </label>
        ))}
      </div>
    </div>
    {challengeCount > 1 && (
      <div className={settingsStyles.field}>
        <span id={`${id}-challenges`}>Author passed</span>
        <div className={styles.chips} role='group' aria-labelledby={`${id}-challenges`}>
          {Array.from({ length: challengeCount }, (_, otherIndex) => otherIndex)
            .filter((otherIndex) => otherIndex !== challengeIndex)
            .map((otherIndex) => (
              <label key={otherIndex} className={styles.chip}>
                <input
                  type='checkbox'
                  checked={Boolean(exclude.challenges?.includes(otherIndex))}
                  onChange={() => onChange((current) => toggleExcludeChallenge(current, otherIndex))}
                />
                challenge {otherIndex + 1}
              </label>
            ))}
        </div>
      </div>
    )}
    <div className={styles.numberFields}>
      {NUMBER_FIELDS.map(({ field, label, hint }) => (
        <label key={field} className={settingsStyles.field} htmlFor={`${id}-${field}`}>
          <span>
            {label}
            {hint && <span className={styles.hint}> ({hint})</span>}
          </span>
          <input
            id={`${id}-${field}`}
            className={settingsStyles.input}
            type='number'
            min={0}
            step={1}
            value={exclude[field] ?? ''}
            onChange={(event) => onChange((current) => setExcludeNumber(current, field, event.target.value === '' ? undefined : Number(event.target.value)))}
          />
        </label>
      ))}
    </div>
    {exclude.rateLimit !== undefined && (
      <label className={settingsStyles.field} htmlFor={`${id}-rate-limit-mode`}>
        Free actions count
        <select
          id={`${id}-rate-limit-mode`}
          className={settingsStyles.select}
          value={String(exclude.rateLimitChallengeSuccess)}
          onChange={(event) =>
            onChange((current) => setExcludeRateLimitChallengeSuccess(current, event.target.value === 'undefined' ? undefined : event.target.value === 'true'))
          }
        >
          {RATE_LIMIT_MODES.map(({ value, label }) => (
            <option key={String(value)} value={String(value)}>
              {label}
            </option>
          ))}
        </select>
      </label>
    )}
  </fieldset>
);

/** What an exclude group sets, in words, for communities whose settings only their own node can change. */
const describeExclude = (exclude: ChallengeExclude) => {
  const parts: string[] = [];
  const addresses = getExcludeAddresses(exclude);
  if (addresses.length > 0) parts.push(`author is ${addresses.map(getDisplayAddress).join(', ')}`);
  if (exclude.roles?.length) parts.push(`author's role is ${exclude.roles.join(' or ')}`);
  const types = EXCLUDE_PUBLICATION_TYPES.filter((type) => exclude.publicationType?.[type]);
  if (types.length > 0) parts.push(`publishing a ${types.map((type) => PUBLICATION_TYPE_LABELS[type]).join(' or ')}`);
  if (exclude.challenges?.length) parts.push(`author passed challenge ${exclude.challenges.map((index) => index + 1).join(' or ')}`);
  if (typeof exclude.postCount === 'number') parts.push(`${exclude.postCount}+ posts`);
  if (typeof exclude.replyCount === 'number') parts.push(`${exclude.replyCount}+ comments`);
  if (exclude.postScore !== undefined) parts.push(`post karma ≥ ${exclude.postScore}`);
  if (exclude.replyScore !== undefined) parts.push(`comment karma ≥ ${exclude.replyScore}`);
  if (exclude.firstCommentTimestamp !== undefined) parts.push(`account age ≥ ${exclude.firstCommentTimestamp}s`);
  if (exclude.rateLimit !== undefined) parts.push(`${exclude.rateLimit} free actions per hour`);
  return parts.length > 0 ? parts.join(', ') : 'no conditions';
};

const ChallengeCard = ({
  challenge,
  index,
  challengeCount,
  info,
  challengeNames,
  isReadOnly,
  draft,
}: {
  challenge: ChallengeSetting;
  index: number;
  challengeCount: number;
  info: ChallengeInfo | undefined;
  challengeNames: string[];
  isReadOnly: boolean;
  draft: ChallengesDraft;
}) => {
  const id = `community-challenge-${index}`;
  const groups = challenge.exclude ?? [];
  // opens where groups exist, then stays as the user leaves it, even after the last group is removed
  const [showGroups, setShowGroups] = useState(groups.length > 0);
  const description = info?.description || challenge.description;
  // A name the node does not offer still shows, so a saved choice is never silently replaced.
  const names = challenge.name && !challengeNames.includes(challenge.name) ? [challenge.name, ...challengeNames] : challengeNames;

  return (
    <li className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Challenge {index + 1}</span>
        {isReadOnly ? (
          <span className={styles.value}>{challenge.name || (challenge.type ? `${challenge.type} challenge` : 'unknown')}</span>
        ) : (
          <select
            className={settingsStyles.select}
            aria-label={`Challenge ${index + 1}`}
            value={challenge.name}
            onChange={(event) => draft.setChallengeName(index, event.target.value)}
          >
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        {!isReadOnly && (
          <button type='button' className={styles.iconButton} aria-label={`Remove challenge ${index + 1}`} onClick={() => draft.removeChallenge(index)}>
            <CloseIcon size={16} />
          </button>
        )}
      </div>
      {description && <p className={settingsStyles.description}>{description}</p>}
      {info?.optionInputs?.map((input) => {
        const label = (
          <span>
            {input.label}
            {input.description && (
              <span className={styles.hint}>
                {' '}
                {input.description}
                {input.default ? ` (default: ${input.default})` : ''}
              </span>
            )}
          </span>
        );
        return isReadOnly ? (
          <div key={input.option} className={settingsStyles.field}>
            {label}
            <span className={styles.value}>{challenge.options?.[input.option] || '—'}</span>
          </div>
        ) : (
          <label key={input.option} className={settingsStyles.field} htmlFor={`${id}-${input.option}`}>
            {label}
            <input
              id={`${id}-${input.option}`}
              className={settingsStyles.input}
              value={challenge.options?.[input.option] ?? ''}
              placeholder={input.placeholder}
              onChange={(event) => draft.setChallengeOption(index, input.option, event.target.value)}
            />
          </label>
        );
      })}
      {isReadOnly ? (
        groups.length > 0 && (
          <div className={settingsStyles.field}>
            Skipped when
            <ul className={styles.summaryList}>
              {groups.map((group, groupIndex) => (
                <li key={groupIndex}>{describeExclude(group)}</li>
              ))}
            </ul>
          </div>
        )
      ) : (
        <details className={styles.groups} open={showGroups} onToggle={(event) => setShowGroups(event.currentTarget.open)}>
          <summary>Skip this challenge for some authors{groups.length > 0 ? ` (${groups.length})` : ''}</summary>
          <p className={styles.hint}>An author who matches everything a group sets skips this challenge.</p>
          {groups.map((group, groupIndex) => (
            <ExcludeGroup
              key={groupIndex}
              id={`${id}-group-${groupIndex}`}
              index={groupIndex}
              challengeIndex={index}
              challengeCount={challengeCount}
              exclude={group}
              onChange={(update) => draft.updateExcludeGroup(index, groupIndex, update)}
              onRemove={() => draft.removeExcludeGroup(index, groupIndex)}
            />
          ))}
          <button type='button' className={`${modernStyles.secondaryButton} ${settingsStyles.button}`} onClick={() => draft.addExcludeGroup(index)}>
            <PlusIcon size={16} />
            Add a group
          </button>
        </details>
      )}
    </li>
  );
};

interface ChallengeEditorProps {
  publishedChallenges: ChallengeSetting[] | undefined;
  challengeNames: string[];
  challengesSettings: Record<string, ChallengeInfo> | undefined;
  isReadOnly: boolean;
  isCreating: boolean;
}

/** The anti-spam challenges authors complete before they can publish, and the authors each one skips. */
const ChallengeEditor = ({ publishedChallenges, challengeNames, challengesSettings, isReadOnly, isCreating }: ChallengeEditorProps) => {
  const { t } = useTranslation();
  const draft = useCommunityChallengesDraft(publishedChallenges);
  const { challenges } = draft;

  return (
    <SettingsSection id='challenges' title={t('challenges')} description={t('challenges_subtitle')}>
      {isReadOnly && <p className={settingsStyles.status}>Only the node that runs this community can read or change its challenges. These are the ones it publishes.</p>}
      {challenges.length === 0 && !isCreating && (
        <p className={`${settingsStyles.status} ${settingsStyles.statusError}`} role='status'>
          {t('warning_spam')}
        </p>
      )}
      <ul className={styles.cards}>
        {challenges.map((challenge, index) => (
          <ChallengeCard
            key={index}
            challenge={challenge}
            index={index}
            challengeCount={challenges.length}
            info={challenge.name ? challengesSettings?.[challenge.name] : undefined}
            challengeNames={challengeNames}
            isReadOnly={isReadOnly}
            draft={draft}
          />
        ))}
      </ul>
      {!isReadOnly && (
        <button type='button' className={`${modernStyles.secondaryButton} ${settingsStyles.button}`} onClick={draft.addChallenge}>
          <PlusIcon size={16} />
          <span className={modernStyles.sentenceCase}>{t('add_a_challenge')}</span>
        </button>
      )}
    </SettingsSection>
  );
};

export default ChallengeEditor;
