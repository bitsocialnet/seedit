import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCommunities, type Community as CommunityType } from '@bitsocial/bitsocial-react-hooks';
import { SEEDIT_DIRECTORY_CODES, isDirectoryCode, type SeeditDirectoryCode } from '../../lib/utils/directory-codes';
import { useDirectoryList } from '../../hooks/use-directory-list';
import { pickDirectoryWinner, sortDirectoryCommunitiesByRank, type DirectoryListCommunity } from '../../lib/utils/directory-list-utils';
import { deriveCommunityNsfw } from '../../lib/utils/nsfw-utils';
import { vendoredDirectoryDefaults, vendoredDirectoryLists } from '../../lib/utils/vendored-directory-lists';
import { getCommunityIdentifiers } from '../../hooks/use-community-identifier';
import { DIRECTORY_INDEX_PATH, getCommunityPath, getDirectoryCandidatesPath, getDirectoryPath } from '../../lib/utils/community-route-utils';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import SubscribeButton from '../../components/subscribe-button';
import CommunityItem, { NoCommunitiesMessage } from './community-item';
import DirectorySearch from './directory-search';
import communityStyles from './communities.module.css';
import styles from './directory-vote.module.css';

const getDirectoryMetadata = (directoryCode: SeeditDirectoryCode) => vendoredDirectoryDefaults.directories[directoryCode];

const useDirectorySearchQuery = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const setQuery = (nextQuery: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextQuery) nextSearchParams.set('q', nextQuery);
    else nextSearchParams.delete('q');
    setSearchParams(nextSearchParams, { replace: true });
  };

  return { query, setQuery };
};

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

const directoryMatchesSearch = (
  query: string,
  directoryCode: SeeditDirectoryCode,
  metadata: { title?: string; description?: string },
  tags: string[] | undefined,
): boolean => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [directoryCode, metadata.title, metadata.description, ...(tags ?? [])].some((value) => value?.toLowerCase().includes(normalizedQuery));
};

const DirectoryIndexRow = ({ directoryCode, query, onTagSelect }: { directoryCode: SeeditDirectoryCode; query: string; onTagSelect: (tag: string) => void }) => {
  const { t } = useTranslation();
  const { list } = useDirectoryList(directoryCode);
  const winner = list && pickDirectoryWinner(list.communities);
  const metadata = getDirectoryMetadata(directoryCode) ?? {};
  const { title, description } = metadata;
  const tags = vendoredDirectoryLists[directoryCode].tags;

  if (!directoryMatchesSearch(query, directoryCode, metadata, tags)) return null;

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
          <span>{t('directory_candidates_count', { count: list?.communities.length ?? 0 })}</span>
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
  const hasVendoredMatch = SEEDIT_DIRECTORY_CODES.some((directoryCode) => {
    const metadata = getDirectoryMetadata(directoryCode) ?? {};
    return directoryMatchesSearch(query, directoryCode, metadata, vendoredDirectoryLists[directoryCode].tags);
  });

  return (
    <>
      <DirectorySearch label={t('search_directories')} query={query} onQueryChange={setQuery} />
      <ul className={styles.directoryIndex} role='list'>
        {SEEDIT_DIRECTORY_CODES.map((directoryCode) => (
          <DirectoryIndexRow key={directoryCode} directoryCode={directoryCode} query={query} onTagSelect={setQuery} />
        ))}
      </ul>
      {!hasVendoredMatch && <p className={styles.directoryNoResults}>{t('no_directories_found')}</p>}
    </>
  );
};

const communityMatchesSearch = (query: string, candidate: DirectoryListCommunity, community: CommunityType): boolean => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [candidate.address, candidate.owner, ...(candidate.tags ?? []), community.shortAddress, community.title, community.description].some((value) =>
    value?.toLowerCase().includes(normalizedQuery),
  );
};

const DirectoryCandidateList = ({ directoryCode }: { directoryCode: SeeditDirectoryCode }) => {
  const { t } = useTranslation();
  const { query, setQuery } = useDirectorySearchQuery();
  const { list } = useDirectoryList(directoryCode);
  const ranked = list ? sortDirectoryCommunitiesByRank(list.communities) : [];

  const { communities } = useCommunities({ communities: getCommunityIdentifiers(ranked.map(({ address }) => address)) });
  // Index by address rather than by request position: a candidate that has not loaded yet must keep
  // its rank instead of dropping out of the competition, and must never inherit a neighbour's data.
  const loadedCommunities = new Map(
    Object.values(communities ?? {})
      .filter((community): community is CommunityType => Boolean(community?.address))
      .map((community) => [community.address, community]),
  );
  const { title, description } = getDirectoryMetadata(directoryCode) ?? {};
  const visibleCandidates = ranked.reduce<{ candidate: DirectoryListCommunity; community: CommunityType; rankIndex: number }[]>((matches, candidate, rankIndex) => {
    const community = loadedCommunities.get(candidate.address) ?? ({ address: candidate.address } as CommunityType);
    if (communityMatchesSearch(query, candidate, community)) matches.push({ candidate, community, rankIndex });
    return matches;
  }, []);

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
      {ranked.length === 0 ? (
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
  const { directoryCode } = useParams();

  if (!isDirectoryCode(directoryCode)) {
    return <Navigate to='/not-found' replace />;
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
