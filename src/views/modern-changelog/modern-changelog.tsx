import { useEffect } from 'react';
import useScrollToTop from '../../hooks/use-scroll-to-top';
import ChangelogReleases from '../../components/changelog-releases';
import { ModernColumns } from '../../components/modern-layout';
import { modernStaticPageStyles } from '../../components/modern-static-page';
import styles from './modern-changelog.module.css';

/** Every Seedit release, newest first, in the modern interface. */
const ModernChangelog = () => {
  useScrollToTop();
  useEffect(() => {
    document.title = 'Changelog - Seedit';
  }, []);

  return (
    <ModernColumns>
      <header className={modernStaticPageStyles.header}>
        <h1 className={modernStaticPageStyles.heading}>Changelog</h1>
      </header>
      <ChangelogReleases
        classes={{
          page: modernStaticPageStyles.page,
          notice: modernStaticPageStyles.notice,
          currentVersion: modernStaticPageStyles.emphasis,
          index: styles.index,
          indexLabel: styles.indexLabel,
          release: styles.release,
          releaseHeading: styles.releaseHeading,
          releaseVersion: styles.releaseVersion,
          releaseDate: styles.releaseDate,
          runningTag: styles.runningTag,
          compareLink: styles.compareLink,
          section: styles.section,
          sectionHeading: styles.sectionHeading,
          commits: styles.commits,
          scope: styles.scope,
          hash: styles.hash,
        }}
      />
    </ModernColumns>
  );
};

export default ModernChangelog;
