import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useNotFoundStore from '../../stores/use-not-found-store';
import styles from './not-found.module.css';

const totalNotFoundImages = 4;

const NotFoundImage = () => {
  const [imagePath] = useState(() => {
    const randomBannerIndex = Math.floor(Math.random() * totalNotFoundImages) + 1;
    return `assets/not-found/not-found-${randomBannerIndex}.png`;
  });

  return <img src={imagePath} alt='' />;
};

const NotFound = () => {
  const { t } = useTranslation();
  const setNotFound = useNotFoundStore((state) => state.setNotFound);

  useEffect(() => {
    setNotFound(true);
    return () => setNotFound(false); // Reset on unmount
  }, [setNotFound]);

  return (
    <div className={styles.content}>
      <div className={styles.notFound}>
        <NotFoundImage />
        <h1>{t('page_not_found')}</h1>
        <p>{t('not_found_description')}</p>
      </div>
    </div>
  );
};

export default NotFound;
