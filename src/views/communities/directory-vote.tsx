import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SeeditDirectoryCode } from '../../lib/utils/directory-codes';
import { deriveCommunityNsfw } from '../../lib/utils/nsfw-utils';
import { useDirectoryCandidates, useDirectoryEntry, useDirectoryIndex, useDirectoryRoute, useDirectorySearchQuery } from '../../hooks/use-directories';
import { DIRECTORY_INDEX_PATH, getCommunityPath, getDirectoryCandidatesPath, getDirectoryPath } from '../../lib/utils/community-route-utils';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import ErrorDisplay from '../../components/error-display';
import LoadingEllipsis from '../../components/loading-ellipsis';
import SubscribeButton from '../../components/subscribe-button';
import CommunityItem, { NoCommunitiesMessage } from './community-item';
import DirectorySearch from './directory-search';
import communityStyles from './communities.module.css';
import styles from './directory-vote.module.css';

const DirectoryTags = ({ tags, onSelect }: { tags: string[] | undefined; onSelect?: (tag: string) => void }) =>
  tags?.length ? (
    <div className={styles.directoryTags}>
      {tags.map((tag) =>
        onSelect ? (
          <button key={tag} type='button' onClick={() => onSelect(tag)}>
            {tag}
          </button>
        ) : (
          <span key={tag}>{tag}</span>
        ),
      )}
    </div>
  ) : null;

const DirectoryIndexRow = ({ directoryCode, query, onTagSelect }: { directoryCode: SeeditDirectoryCode; query: string; onTagSelect: (tag: string) => void }) => {
  const { t } = useTranslation();
  const { list, error, title, description, tags, winner, matchesSearch } = useDirectoryEntry(directoryCode, query);

  if (!matchesSearch) return null;

  return (
    <li className={styles.directoryRow}>
      <div className={styles.directoryMidcol}>
        {winner && list && <SubscribeButton address={winner.address} directoryCode={directoryCode} directoryRevision={list.revision} />}
      </div>
      <div className={styles.directoryEntry}>
        <div className={styles.directoryTitle}>
          <Link to={getDirectoryCandidatesPath(directoryCode)}>
            s/{directoryCode}
            {title && <span className={styles.directoryName}>: {title}</span>}
          </Link>
        </div>
        {description && <p className={styles.directoryDescription}>{description}</p>}
        <DirectoryTags tags={tags} onSelect={onTagSelect} />
        <div className={styles.directoryTagline}>
          {winner && (
            <span className={styles.directoryWinner}>
              <span className={styles.directoryWinnerLabel}>{t('current_winner')}</span>{' '}
              <Link to={getCommunityPath(winner.address)}>{getDisplayAddress(winner.address)}</Link>
              <span className={styles.directoryFactSeparator} aria-hidden='true'>
                ·
              </span>
            </span>
          )}
          {/* Directories published after this build have no bundled list until the fetch completes. */}
          <span>{list ? t('directory_candidates_count', { count: list.communities.length }) : error ? t('failed') : <LoadingEllipsis string={t('loading')} />}</span>
          {list && (
            <>
              <span className={styles.directoryFactSeparator} aria-hidden='true'>
                ·
              </span>
              <span>{t('directory_list_revision', { revision: list.revision })}</span>
            </>
          )}
        </div>
      </div>
    </li>
  );
};

/** Lists every reserved /s/ route so a voter can pick which directory to inspect. */
export const DirectoryIndex = () => {
  const { t } = useTranslation();
  const { query, setQuery } = useDirectorySearchQuery();
  const { codes, hasMatch } = useDirectoryIndex(query);

  return (
    <>
      <DirectorySearch label={t('search_directories')} query={query} onQueryChange={setQuery} />
      <ul className={styles.directoryIndex} role='list'>
        {codes.map((directoryCode) => (
          <DirectoryIndexRow key={directoryCode} directoryCode={directoryCode} query={query} onTagSelect={setQuery} />
        ))}
      </ul>
      {!hasMatch && <p className={styles.directoryNoResults}>{t('no_directories_found')}</p>}
    </>
  );
};

const DirectoryCandidateList = ({ directoryCode }: { directoryCode: SeeditDirectoryCode }) => {
  const { t } = useTranslation();
  const { query, setQuery } = useDirectorySearchQuery();
  const { list, error, title, description, ranked, visibleCandidates } = useDirectoryCandidates(directoryCode, query);

  return (
    <>
      <div className={styles.directoryHeading}>
        <Link className={styles.directoryBackLink} to={DIRECTORY_INDEX_PATH}>
          ← {t('back_to_all_directories')}
        </Link>
        <div>
          <span className={styles.directoryHeadingTitle}>
            <Link to={getDirectoryPath(directoryCode)}>s/{directoryCode}</Link>
            {title && `: ${title}`}
          </span>
          {list && <span className={styles.directoryRevision}>{t('directory_list_revision', { revision: list.revision })}</span>}
        </div>
        {description && <p className={styles.directoryHeadingDescription}>{description}</p>}
        <DirectoryTags tags={list?.tags} />
      </div>
      <DirectorySearch label={t('search_communities')} query={query} onQueryChange={setQuery} />
      {!list ? (
        error ? (
          <ErrorDisplay error={error} />
        ) : (
          <p className={styles.directoryNoResults}>
            <LoadingEllipsis string={t('loading')} />
          </p>
        )
      ) : ranked.length === 0 ? (
        <NoCommunitiesMessage />
      ) : visibleCandidates.length === 0 ? (
        <p className={styles.directoryNoResults}>{t('no_matches_found_for', { query })}</p>
      ) : (
        visibleCandidates.map(({ candidate, community, rankIndex }) => (
          <CommunityItem
            key={candidate.address}
            community={community}
            index={rankIndex}
            score={candidate.score}
            owner={candidate.owner}
            isWinner={rankIndex === 0}
            nsfw={deriveCommunityNsfw(community, candidate)}
            tags={candidate.tags}
            linkTags={false}
          />
        ))
      )}
    </>
  );
};

/** Ranked candidates competing for one reserved /s/ route. */
export const DirectoryCandidates = () => {
  const { knownDirectoryCode: directoryCode } = useDirectoryRoute();

  // Communities renders not found for an unknown code
  if (!directoryCode) {
    return null;
  }

  return <DirectoryCandidateList directoryCode={directoryCode} />;
};

/** Explains directory voting and why the controls are inert, above every directory view. */
export const DirectoryVoteNotice = () => {
  const { t } = useTranslation();

  return (
    <div className={communityStyles.infobar}>
      <div>{t('directory_vote_explanation')}</div>
      <div className={styles.eligibility}>
        {t('directory_vote_not_open')} <Link to='/gold'>{t('directory_vote_eligibility_link')}</Link>
      </div>
    </div>
  );
};
