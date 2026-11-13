import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ModernHeader from './modern-header';
import ModernNav from './modern-nav';
import styles from './modern-layout.module.css';

const ModernLayout = () => {
  const { pathname } = useLocation();
  // The drawer belongs to the page it was opened on, so any navigation closes it without an effect.
  const [navOpenPathname, setNavOpenPathname] = useState<string | null>(null);
  const isNavOpen = navOpenPathname === pathname;
  const closeNav = () => setNavOpenPathname(null);
  const toggleNav = () => setNavOpenPathname(isNavOpen ? null : pathname);

  useEffect(() => {
    if (!isNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpenPathname(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isNavOpen]);

  return (
    <div className={styles.shell}>
      <ModernHeader isNavOpen={isNavOpen} onToggleNav={toggleNav} />
      <div className={styles.body}>
        <ModernNav isOpen={isNavOpen} onClose={closeNav} />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

interface ModernColumnsProps {
  children: ReactNode;
  rail?: ReactNode;
}

/** The content column with an optional right rail, which drops below 1200px. */
export const ModernColumns = ({ children, rail }: ModernColumnsProps) => (
  <div className={styles.columns}>
    <div className={styles.content}>{children}</div>
    {rail && <aside className={styles.rail}>{rail}</aside>}
  </div>
);

interface ModernRailSectionProps {
  title?: ReactNode;
  children: ReactNode;
}

/** A section of the right rail. */
export const ModernRailSection = ({ title, children }: ModernRailSectionProps) => (
  <section className={styles.railSection}>
    {title && <h2 className={styles.railTitle}>{title}</h2>}
    {children}
  </section>
);

export default ModernLayout;
