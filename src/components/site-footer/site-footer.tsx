import { Link } from 'react-router-dom';
import styles from './site-footer.module.css';

const ExternalLink = ({ href, children }: { href: string; children: string }) => (
  <a href={href} target='_blank' rel='noopener noreferrer'>
    {children}
  </a>
);

const SiteFooter = () => (
  <footer className={styles.footer} aria-label='Seedit footer'>
    <nav className={styles.panel} aria-label='Footer links'>
      <section className={styles.column}>
        <h2 className={styles.heading}>about</h2>
        <ul>
          <li>
            <ExternalLink href='https://bitsocial.net/blog?q=seedit'>blog</ExternalLink>
          </li>
          <li>
            <ExternalLink href='https://bitsocial.net/projects/seedit'>about</ExternalLink>
          </li>
          <li>
            <Link to='/changelog'>changelog</Link>
          </li>
        </ul>
      </section>
      <section className={styles.column}>
        <h2 className={styles.heading}>help</h2>
        <ul>
          <li>
            <ExternalLink href='https://bitsocial.net/docs'>docs</ExternalLink>
          </li>
          <li>
            <ExternalLink href='https://github.com/bitsocialnet/seedit/issues/new'>feedback</ExternalLink>
          </li>
          <li>
            <ExternalLink href='https://github.com/bitsocialnet/seedit/graphs/contributors'>contributors</ExternalLink>
          </li>
        </ul>
      </section>
      <section className={styles.column}>
        <h2 className={styles.heading}>apps &amp; tools</h2>
        <ul>
          <li>
            <ExternalLink href='https://bitsocial.net/projects/seedit'>seedit</ExternalLink>
          </li>
        </ul>
      </section>
      <section className={styles.column}>
        <h2 className={styles.heading}>&lt;3</h2>
        <ul>
          <li>
            <Link className={styles.goldLink} to='/gold' onClick={() => requestAnimationFrame(() => window.scrollTo({ top: 0 }))}>
              seedit gold
            </Link>
          </li>
        </ul>
      </section>
    </nav>
    <p className={styles.legal}>
      Seedit is FOSS under GPL-3.0-or-later. Powered by Bitsocial
      <a className={styles.bitsocialLogoLink} href='https://bitsocial.net' target='_blank' rel='noopener noreferrer' aria-label='Bitsocial'>
        <img className={styles.bitsocialLogo} src='assets/logo/bitsocial.svg' alt='' width='18' height='18' />
      </a>
    </p>
  </footer>
);

export default SiteFooter;
