import { HashLink } from 'react-router-hash-link';
import { version as currentVersion } from '../../../package.json';
import changelogMarkdown from '../../../CHANGELOG.md?raw';
import { getReleaseAnchorId, parseChangelog } from '../../lib/utils/changelog-utils';

// the changelog ships with the build, so parsing it once per chunk load is enough
const releases = parseChangelog(changelogMarkdown);

export type ChangelogClasses = Record<
  | 'page'
  | 'commits'
  | 'compareLink'
  | 'currentVersion'
  | 'hash'
  | 'index'
  | 'indexLabel'
  | 'notice'
  | 'release'
  | 'releaseDate'
  | 'releaseHeading'
  | 'releaseVersion'
  | 'runningTag'
  | 'scope'
  | 'section'
  | 'sectionHeading',
  string
>;

/** Every release in the bundled changelog, newest first, styled by the interface that shows it. */
const ChangelogReleases = ({ classes }: { classes: ChangelogClasses }) => (
  <div className={classes.page}>
    <div className={classes.notice}>
      Every Seedit release, newest first, taken from the repository changelog at build time. You are running{' '}
      <span className={classes.currentVersion}>v{currentVersion}</span>. Downloads and full release notes live on{' '}
      <a href='https://github.com/bitsocialnet/seedit/releases' target='_blank' rel='noopener noreferrer'>
        GitHub releases
      </a>
      .
    </div>
    {releases.length > 1 && (
      <nav className={classes.index} aria-label='Jump to a release'>
        <span className={classes.indexLabel}>jump to:</span>
        <ul>
          {releases.map((release) => (
            <li key={release.version}>
              <HashLink to={`/changelog#${getReleaseAnchorId(release.version)}`}>v{release.version}</HashLink>
            </li>
          ))}
        </ul>
      </nav>
    )}
    {releases.map((release) => (
      <section className={classes.release} key={release.version}>
        <h2 className={classes.releaseHeading} id={getReleaseAnchorId(release.version)}>
          <span className={classes.releaseVersion}>v{release.version}</span> <span className={classes.releaseDate}>{release.date}</span>{' '}
          {release.version === currentVersion && <span className={classes.runningTag}>running</span>}{' '}
          {release.compareUrl && (
            <a className={classes.compareLink} href={release.compareUrl} target='_blank' rel='noopener noreferrer'>
              compare
            </a>
          )}
        </h2>
        {release.sections.map((section, sectionIndex) => (
          <div className={classes.section} key={`${section.title}-${sectionIndex}`}>
            {section.title && <h3 className={classes.sectionHeading}>{section.title}</h3>}
            <ul className={classes.commits}>
              {section.entries.map((entry, entryIndex) => (
                <li key={`${entry.hash ?? section.title}-${entryIndex}`}>
                  {entry.scope && <span className={classes.scope}>{entry.scope}:</span>}{' '}
                  {entry.description.map((segment, segmentIndex) =>
                    segment.url ? (
                      <a href={segment.url} key={segmentIndex} target='_blank' rel='noopener noreferrer'>
                        {segment.text}
                      </a>
                    ) : (
                      <span key={segmentIndex}>{segment.text}</span>
                    ),
                  )}{' '}
                  {entry.hash && (
                    <a className={classes.hash} href={entry.url} target='_blank' rel='noopener noreferrer'>
                      {entry.hash}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    ))}
  </div>
);

export default ChangelogReleases;
