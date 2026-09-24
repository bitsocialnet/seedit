import { useEffect, useRef, useState } from 'react';
import styles from './sticky-header.module.css';
import AccountBar from '../account-bar';
import TopBar from '../topbar';
import debounce from 'lodash/debounce';
import { useTopbarAutoHideEnabled } from '../../hooks/use-topbar-auto-hide';

const StickyHeaderContent = ({ animate }: { animate: boolean }) => {
  // navbar animation on scroll
  const [visible, setVisible] = useState(true);
  const prevScrollPosRef = useRef(0);

  useEffect(() => {
    if (!animate) return;

    prevScrollPosRef.current = window.scrollY;
    const debouncedHandleScroll = debounce(() => {
      const currentScrollPos = window.scrollY;
      const prevScrollPos = prevScrollPosRef.current;

      setVisible(prevScrollPos > currentScrollPos || currentScrollPos < 10);
      prevScrollPosRef.current = currentScrollPos;
    }, 50);

    window.addEventListener('scroll', debouncedHandleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', debouncedHandleScroll);
      debouncedHandleScroll.cancel();
    };
  }, [animate]);

  return (
    <div className={styles.content} style={{ transform: animate && !visible ? 'translateY(-40px)' : 'translateY(0)' }}>
      <TopBar />
      <AccountBar />
    </div>
  );
};

const StickyHeader = () => {
  const autoHideEnabled = useTopbarAutoHideEnabled();

  return <StickyHeaderContent key={String(autoHideEnabled)} animate={autoHideEnabled} />;
};

export default StickyHeader;
