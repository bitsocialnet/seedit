import useIsMobile from '../../hooks/use-is-mobile';
import GoldFaqContent from '../../components/gold-faq';
import Sidebar from '../../components/sidebar';
// the gold page is a FAQ with gold accents, so it reuses the shared static-page chrome
import pageStyles from '../../components/static-page';
import styles from './gold.module.css';

export const GoldFaq = () => {
  const isMobile = useIsMobile();
  return <GoldFaqContent classes={{ page: pageStyles.about, toc: isMobile ? pageStyles.tocMobile : pageStyles.toc, notice: styles.notice, goldName: styles.goldName }} />;
};

const Gold = () => {
  const isMobile = useIsMobile();

  return (
    <div className={pageStyles.content}>
      {!isMobile && <Sidebar />}
      <GoldFaq />
    </div>
  );
};

export default Gold;
