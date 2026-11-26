import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ModernColumns, modernStyles } from '../modern-layout';
import styles from './modern-not-found.module.css';

const NOT_FOUND_IMAGE_COUNT = 4;

/** A route that names nothing, with a way back; an optional link points to the closest page that exists. */
const ModernNotFound = ({ backTo = '/', backLabel }: { backTo?: string; backLabel?: string }) => {
  const { t } = useTranslation();
  const [imagePath] = useState(() => `assets/not-found/not-found-${Math.floor(Math.random() * NOT_FOUND_IMAGE_COUNT) + 1}.png`);

  return (
    <ModernColumns>
      <div className={styles.notFound}>
        <img src={imagePath} alt='' className={styles.image} />
        <h1 className={styles.heading}>{t('page_not_found')}</h1>
        <p className={styles.description}>{t('not_found_description')}</p>
        <Link to={backTo} className={modernStyles.primaryButton}>
          <span className={modernStyles.sentenceCase}>{backLabel ?? t('home')}</span>
        </Link>
      </div>
    </ModernColumns>
  );
};

export default ModernNotFound;
