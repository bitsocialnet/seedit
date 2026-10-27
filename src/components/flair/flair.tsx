import styles from './flair.module.css';

interface FlairProps {
  flair: {
    text: string;
    backgroundColor?: string;
    textColor?: string;
    expiresAt?: number;
  };
  author?: boolean;
}

export type FlairData = FlairProps['flair'];

const Flair = ({ flair, author }: FlairProps) => {
  const isExpired = flair.expiresAt ? Date.now() / 1000 > flair.expiresAt : false;

  if (isExpired) {
    return null;
  }

  // author flairs follow old.reddit's user flair: inherit the tagline size, blank flair colors unless the community sets its own
  if (author) {
    return (
      <span className={styles.authorFlair} style={{ backgroundColor: flair.backgroundColor, color: flair.textColor }} title={flair.text}>
        {flair.text}
      </span>
    );
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
