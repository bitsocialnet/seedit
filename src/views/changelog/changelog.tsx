import { HashLink } from 'react-router-hash-link';
import useIsMobile from '../../hooks/use-is-mobile';
import Sidebar from '../../components/sidebar';
import packageJson from '../../../package.json';
import changelogMarkdown from '../../../CHANGELOG.md?raw';
import { getReleaseAnchorId, parseChangelog } from '../../lib/utils/changelog-utils';
// the changelog uses the shared static-page chrome with a dense release log inside it
import pageStyles from '../../components/static-page';
import styles from './changelog.module.css';

// the changelog ships with the build, so parsing it once per chunk load is enough
const releases = parseChangelog(changelogMarkdown);
const { version: currentVersion } = packageJson;

export const ChangelogLog = () => (
  <div className={pageStyles.about}>
    <div className={styles.notice}>
      Every Seedit release, newest first, taken from the repository changelog at build time. You are running{' '}
      <span className={styles.currentVersion}>v{currentVersion}</span>. Downloads and full release notes live on{' '}
      <a href='https://github.com/bitsocialnet/seedit/releases' target='_blank' rel='noopener noreferrer'>
        GitHub releases
      </a>
      .
    </div>
    {releases.length > 1 && (
      <nav className={styles.index} aria-label='Jump to a release'>
        <span className={styles.indexLabel}>jump to:</span>
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
      <section className={styles.release} key={release.version}>
        <h2 className={styles.releaseHeading} id={getReleaseAnchorId(release.version)}>
          <span className={styles.releaseVersion}>v{release.version}</span> <span className={styles.releaseDate}>{release.date}</span>{' '}
          {release.version === currentVersion && <span className={styles.runningTag}>running</span>}{' '}
          {release.compareUrl && (
            <a className={styles.compareLink} href={release.compareUrl} target='_blank' rel='noopener noreferrer'>
              compare
            </a>
          )}
        </h2>
        {release.sections.map((section, sectionIndex) => (
          <div className={styles.section} key={`${section.title}-${sectionIndex}`}>
            {section.title && <h3 className={styles.sectionHeading}>{section.title}</h3>}
            <ul className={styles.commits}>
              {section.entries.map((entry, entryIndex) => (
                <li key={`${entry.hash ?? section.title}-${entryIndex}`}>
                  {entry.scope && <span className={styles.scope}>{entry.scope}:</span>}{' '}
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
                    <a className={styles.hash} href={entry.url} target='_blank' rel='noopener noreferrer'>
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

const Changelog = () => {
  const isMobile = useIsMobile();

  return (
    <div className={pageStyles.content}>
      {!isMobile && <Sidebar />}
      <ChangelogLog />
    </div>
  );
};

export default Changelog;
