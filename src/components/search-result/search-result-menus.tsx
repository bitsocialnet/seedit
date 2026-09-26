import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSearchPath, SEARCH_SORTS, SEARCH_TIMES, type SearchOptions, type SearchSort, type SearchTime } from '../../lib/utils/search-utils';
import styles from './search-result.module.css';

const SORT_LABEL_KEYS: Record<SearchSort, string> = {
  relevance: 'relevance',
  top: 'top',
  new: 'new',
  comments: 'comments',
};

const TIME_LABEL_KEYS: Record<SearchTime, string> = {
  hour: 'past_hour',
  day: 'past_24_hours',
  week: 'past_week',
  month: 'past_month',
  year: 'past_year',
  all: 'all_time',
};

interface SearchMenuProps {
  choices: { key: string; label: string; path: string }[];
  selectedLabel: string;
  title: string;
}

/** One of old.reddit's light dropdowns: the current choice underlined, the others listed under it. */
const SearchMenu = ({ choices, selectedLabel, title }: SearchMenuProps) => (
  <div>
    {title}:{' '}
    <details className={styles.dropdown}>
      <summary className={styles.selected}>{selectedLabel}</summary>
      <div className={styles.dropChoices}>
        {choices.map(({ key, label, path }) => (
          <Link key={key} onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')} to={path}>
            {label}
          </Link>
        ))}
      </div>
    </details>
  </div>
);

interface SearchResultMenusProps {
  /** The route's own options, so a choice keeps the community and nsfw choice it was made under. */
  options: SearchOptions;
  /** The raw search box text, prefixes included, as the route carries it. */
  query: string;
}

/** The posts group's "sorted by" and "links from" menus. Each choice is a url, so it is shareable and survives a reload. */
const SearchResultMenus = ({ options, query }: SearchResultMenusProps) => {
  const { t } = useTranslation();
  const sort = options.sort ?? 'relevance';
  const time = options.time ?? 'all';

  return (
    <>
      <SearchMenu
        choices={SEARCH_SORTS.filter((choice) => choice !== sort).map((choice) => ({
          key: choice,
          label: t(SORT_LABEL_KEYS[choice]),
          path: getSearchPath(query, { ...options, sort: choice }),
        }))}
        selectedLabel={t(SORT_LABEL_KEYS[sort])}
        title={t('sorted_by')}
      />
      <SearchMenu
        choices={SEARCH_TIMES.filter((choice) => choice !== time).map((choice) => ({
          key: choice,
          label: t(TIME_LABEL_KEYS[choice]),
          path: getSearchPath(query, { ...options, time: choice }),
        }))}
        selectedLabel={t(TIME_LABEL_KEYS[time])}
        title={t('links_from')}
      />
    </>
  );
};

export default SearchResultMenus;
