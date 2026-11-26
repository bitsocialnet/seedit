import useIsMobile from '../../hooks/use-is-mobile';
import ChangelogReleases, { type ChangelogClasses } from '../../components/changelog-releases';
import Sidebar from '../../components/sidebar';
// the changelog uses the shared static-page chrome with a dense release log inside it
import pageStyles from '../../components/static-page';
import styles from './changelog.module.css';

export const ChangelogLog = () => <ChangelogReleases classes={{ ...(styles as Omit<ChangelogClasses, 'page'>), page: pageStyles.about }} />;

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
