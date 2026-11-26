import { useEffect } from 'react';
import useScrollToTop from '../../hooks/use-scroll-to-top';
import GoldFaq from '../../components/gold-faq';
import { ModernColumns } from '../../components/modern-layout';
import { modernStaticPageStyles as styles } from '../../components/modern-static-page';

/** What seedit gold will be, in the modern interface. */
const ModernGold = () => {
  useScrollToTop();
  useEffect(() => {
    document.title = 'Seedit Gold - Seedit';
  }, []);

  return (
    <ModernColumns>
      <header className={styles.header}>
        <h1 className={styles.heading}>Seedit Gold</h1>
      </header>
      <GoldFaq classes={{ page: styles.page, toc: styles.toc, notice: styles.notice, goldName: styles.emphasis }} />
    </ModernColumns>
  );
};

export default ModernGold;
