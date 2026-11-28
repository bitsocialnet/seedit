import { useTranslation } from 'react-i18next';
import { ModernColumns } from './modern-layout';
import layoutStyles from './modern-layout.module.css';
import styles from './modern-page-skeleton.module.css';

const SECTION_COUNT = 3;

/**
 * Stands where a modern page will appear while its code loads: the page heading, its tab bar when it has one, and
 * section cards, in the content column the page itself uses, so the page replaces it without moving.
 */
const ModernPageSkeleton = ({ tabs = 0 }: { tabs?: number }) => {
  const { t } = useTranslation();
  return (
    <ModernColumns>
      <p className={layoutStyles.visuallyHidden} role='status'>
        {t('loading')}
      </p>
      <div aria-hidden='true'>
        <div className={styles.header}>
          <span className={`${styles.bone} ${styles.heading}`} />
        </div>
        {tabs > 0 && (
          <div className={styles.tabBar}>
            {Array.from({ length: tabs }, (_, index) => (
              <span key={index} className={`${styles.bone} ${styles.tab}`} />
            ))}
          </div>
        )}
        <div className={styles.sections}>
          {Array.from({ length: SECTION_COUNT }, (_, index) => (
            <div key={index} className={styles.section}>
              <span className={`${styles.bone} ${styles.title}`} />
              <span className={`${styles.bone} ${styles.line}`} />
              <span className={`${styles.bone} ${styles.control}`} />
            </div>
          ))}
        </div>
      </div>
    </ModernColumns>
  );
};

export default ModernPageSkeleton;
