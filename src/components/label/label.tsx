import { useTranslation } from 'react-i18next';
import styles from './label.module.css';

interface LabelProps {
  color: string;
  text: string;
  isFirstInLine?: boolean;
  title?: string;
}

const Label = ({ color, text, isFirstInLine = false, title = '' }: LabelProps) => {
  const { t } = useTranslation();

  return (
    <span title={title} className={`${styles.label} ${isFirstInLine ? styles.firstInLine : ''}`}>
      <span className={`${styles.stamp} ${styles[color]}`}>{t(text)}</span>
    </span>
  );
};

export default Label;
