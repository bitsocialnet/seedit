import styles from './flair.module.css';

interface FlairProps {
  flair: {
    text: string;
    backgroundColor?: string;
    textColor?: string;
    expiresAt?: number;
  };
}

const Flair = ({ flair }: FlairProps) => {
  const isExpired = flair.expiresAt ? Date.now() / 1000 > flair.expiresAt : false;

  if (isExpired) {
    return null;
  }

  const flairStyle = {
    backgroundColor: flair.backgroundColor || 'defaultColor',
    color: flair.textColor || 'defaultTextColor',
  };

  return (
    <span className={styles.wrapper}>
      <span className={styles.flair} style={flairStyle}>
        {flair.text}
      </span>
    </span>
  );
};

export default Flair;
