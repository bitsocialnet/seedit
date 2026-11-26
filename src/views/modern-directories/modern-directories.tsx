import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useDirectoryCandidates, useDirectoryEntry, useDirectoryIndex, useDirectoryRoute, useDirectorySearchQuery } from '../../hooks/use-directories';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { DIRECTORY_INDEX_PATH, getCommunityPath, getDirectoryCandidatesPath, getDirectoryPath } from '../../lib/utils/community-route-utils';
import type { SeeditDirectoryCode } from '../../lib/utils/directory-codes';
import { getDirectoryCommunityProposalUrl, getNewDirectoryProposalUrl } from '../../lib/utils/directory-proposal-utils';
import { deriveCommunityNsfw } from '../../lib/utils/nsfw-utils';
import ErrorDisplay from '../../components/error-display';
import { ModernJoinButton } from '../../components/modern-community-about';
import ModernCommunityRow from '../../components/modern-community-row';
import ModernNotFound from '../../components/modern-not-found';
import { ExternalLinkIcon, PlusIcon, SearchIcon } from '../../components/modern-icons';
import { ModernColumns, ModernRailSection, modernStyles } from '../../components/modern-layout';
import styles from './modern-directories.module.css';

const capitalize = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** Filters the list as it is typed; the text lives in the URL, so a filtered list can be shared. */
const SearchField = ({ label, query, onQueryChange }: { label: string; query: string; onQueryChange: (query: string) => void }) => (
  <form className={styles.search} role='search' onSubmit={(event) => event.preventDefault()}>
    <SearchIcon size={18} />
    <input type='search' value={query} aria-label={capitalize(label)} placeholder={capitalize(label)} onChange={(event) => onQueryChange(event.target.value)} />
  </form>
);

const Tags = ({ tags, onSelect }: { tags: string[] | undefined; onSelect?: (tag: string) => void }) =>
  tags?.length ? (
    <ul className={styles.tags}>
      {tags.map((tag) => (
        <li key={tag}>
          {onSelect ? (
            <button type='button' className={styles.tag} onClick={() => onSelect(tag)}>
              {tag}
            </button>
          ) : (
            <span className={styles.tag}>{tag}</span>
          )}
        </li>
      ))}
    </ul>
  ) : null;

/** Why the directories exist, and that voting has not opened. */
const VoteNotice = () => {
  const { t } = useTranslation();
  return (
    <p className={styles.notice}>
      {t('directory_vote_explanation')} {t('directory_vote_not_open')}{' '}
      <Link to='/gold' className={styles.textLink}>
        {t('directory_vote_eligibility_link')}
      </Link>
    </p>
  );
};

/** Proposing a directory, or a community for this one, happens on GitHub. */
const ProposalLink = ({ directoryCode, className }: { directoryCode?: SeeditDirectoryCode; className: string }) => {
  const { t } = useTranslation();
  return (
    <a
      href={directoryCode ? getDirectoryCommunityProposalUrl(directoryCode) : getNewDirectoryProposalUrl()}
      target='_blank'
      rel='noopener noreferrer'
      className={className}
    >
      {t(directoryCode ? 'submit_community' : 'propose_new_directory')}
      <ExternalLinkIcon size={16} />
    </a>
  );
};

const ProposalRail = ({ directoryCode }: { directoryCode?: SeeditDirectoryCode }) => {
  const { t } = useTranslation();
  return (
    <ModernRailSection title={<span className={modernStyles.sentenceCase}>{t('directories')}</span>}>
      <div className={styles.railActions}>
        <ProposalLink directoryCode={directoryCode} className={modernStyles.primaryButton} />
        <Link to='/communities/create' className={modernStyles.secondaryButton}>
          <PlusIcon size={16} />
          <span className={modernStyles.sentenceCase}>{t('create_community')}</span>
        </Link>
      </div>
    </ModernRailSection>
  );
};

const DirectoryCard = ({ directoryCode, query, onTagSelect }: { directoryCode: SeeditDirectoryCode; query: string; onTagSelect: (tag: string) => void }) => {
  const { t } = useTranslation();
  const { list, error, title, description, tags, winner, matchesSearch } = useDirectoryEntry(directoryCode, query);
  if (!matchesSearch) return null;

  return (
    <li className={styles.card}>
      <div className={styles.cardBody}>
        <Link to={getDirectoryCandidatesPath(directoryCode)} className={styles.identity}>
          <span className={styles.title}>s/{directoryCode}</span>
          {title && <span className={styles.subtitle}>{title}</span>}
        </Link>
        {description && <p className={styles.description}>{description}</p>}
        <Tags tags={tags} onSelect={onTagSelect} />
        <div className={styles.facts}>
          {winner && (
            <span>
              {capitalize(t('current_winner'))}{' '}
              <Link to={getCommunityPath(winner.address)} className={styles.factLink}>
                s/{getDisplayAddress(winner.address)}
              </Link>
            </span>
          )}
          {/* Directories published after this build have no bundled list until the fetch completes. */}
          <span>{list ? capitalize(t('directory_candidates_count', { count: list.communities.length })) : error ? t('failed') : `${t('loading')}…`}</span>
          {list && <span>{capitalize(t('directory_list_revision', { revision: list.revision }))}</span>}
        </div>
      </div>
      {winner && list && (
        <div className={styles.action}>
          <ModernJoinButton address={winner.address} directoryCode={directoryCode} directoryRevision={list.revision} />
        </div>
      )}
    </li>
  );
};

const DirectoryIndex = () => {
  const { t } = useTranslation();
  const { query, setQuery } = useDirectorySearchQuery();
  const { codes, hasMatch } = useDirectoryIndex(query);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1 className={styles.heading}>{capitalize(t('directories'))}</h1>
          {/* The rail holds the same link from 1200px. */}
          <ProposalLink className={`${modernStyles.secondaryButton} ${styles.headerAction}`} />
        </div>
      </header>
      <VoteNotice />
      <SearchField label={t('search_directories')} query={query} onQueryChange={setQuery} />
      <ul className={styles.cards}>
        {codes.map((directoryCode) => (
          <DirectoryCard key={directoryCode} directoryCode={directoryCode} query={query} onTagSelect={setQuery} />
        ))}
      </ul>
      {!hasMatch && <p className={styles.empty}>{capitalize(t('no_directories_found'))}</p>}
    </>
  );
};

const DirectoryCandidates = ({ directoryCode }: { directoryCode: SeeditDirectoryCode }) => {
  const { t } = useTranslation();
  const { query, setQuery } = useDirectorySearchQuery();
  const { list, error, title, description, ranked, visibleCandidates } = useDirectoryCandidates(directoryCode, query);

  return (
    <>
      <header className={styles.header}>
        <Link to={DIRECTORY_INDEX_PATH} className={styles.backLink}>
          ← {capitalize(t('back_to_all_directories'))}
        </Link>
        <div className={styles.headerRow}>
          <h1 className={styles.heading}>
            <Link to={getDirectoryPath(directoryCode)}>s/{directoryCode}</Link>
            {title && <span className={styles.headingTitle}>{title}</span>}
          </h1>
          <ProposalLink directoryCode={directoryCode} className={`${modernStyles.secondaryButton} ${styles.headerAction}`} />
        </div>
        {description && <p className={styles.description}>{description}</p>}
        <Tags tags={list?.tags} />
        {list && <p className={styles.revision}>{capitalize(t('directory_list_revision', { revision: list.revision }))}</p>}
      </header>
      <VoteNotice />
      <SearchField label={t('search_communities')} query={query} onQueryChange={setQuery} />
      {!list ? (
        error ? (
          <div className={styles.error}>
            <ErrorDisplay error={error} />
          </div>
        ) : (
          <p className={styles.empty} role='status'>{`${t('loading')}…`}</p>
        )
      ) : ranked.length === 0 || visibleCandidates.length === 0 ? (
        <p className={styles.empty}>{capitalize(t('nothing_found'))}</p>
      ) : (
        <ol className={styles.candidates}>
          {visibleCandidates.map(({ candidate, community, rankIndex }) => (
            <li key={candidate.address} className={styles.candidate}>
              <span className={styles.rank} aria-label={`Rank ${rankIndex + 1}`}>
                {rankIndex + 1}
              </span>
              <ModernCommunityRow
                address={candidate.address}
                community={community.createdAt ? community : undefined}
                nsfw={deriveCommunityNsfw(community, candidate) === true}
                tags={candidate.tags}
                directoryCode={directoryCode}
                directoryRevision={list.revision}
                facts={
                  <>
                    {rankIndex === 0 && <span className={`${styles.badge} ${modernStyles.sentenceCase}`}>{t('winner')}</span>}
                    {candidate.owner && (
                      <span title={candidate.owner}>
                        <span className={modernStyles.sentenceCase}>{t('owner')}</span> u/{getDisplayAddress(candidate.owner)}
                      </span>
                    )}
                  </>
                }
              />
            </li>
          ))}
        </ol>
      )}
    </>
  );
};

/**
 * The directories in the modern interface: short s/ routes communities compete for. The index lists them; a directory
 * lists its ranked candidates, the first of which the route resolves to.
 */
const ModernDirectories = () => {
  const { t } = useTranslation();
  const { directoryCode, knownDirectoryCode, isUnknownDirectory } = useDirectoryRoute();

  const title = `${capitalize(t('directories'))}${knownDirectoryCode ? ` - s/${knownDirectoryCode}` : ''}`;
  useEffect(() => {
    document.title = `${title} - Seedit`;
  }, [title]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [directoryCode]);

  if (isUnknownDirectory) return <ModernNotFound backTo={DIRECTORY_INDEX_PATH} backLabel={capitalize(t('back_to_all_directories'))} />;

  return (
    <ModernColumns rail={<ProposalRail directoryCode={knownDirectoryCode} />}>
      {knownDirectoryCode ? (
        <DirectoryCandidates directoryCode={knownDirectoryCode} />
      ) : directoryCode ? (
        <p className={styles.empty} role='status'>{`${t('loading')}…`}</p>
      ) : (
        <DirectoryIndex />
      )}
    </ModernColumns>
  );
};

export default ModernDirectories;
