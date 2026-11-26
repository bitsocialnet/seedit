import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useCommunity } from '@bitsocial/bitsocial-react-hooks';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useResolvedCommunityRoute from '../../hooks/use-resolved-community-route';
import useScrollToTop from '../../hooks/use-scroll-to-top';
import { DIRECTORY_INDEX_PATH, getDirectoryCandidatesPath } from '../../lib/utils/community-route-utils';
import FAQ from '../../components/faq';
import ModernCommunityAbout from '../../components/modern-community-about';
import { ModernColumns } from '../../components/modern-layout';
import { modernStaticPageStyles as styles } from '../../components/modern-static-page';

const LINKS: { label: string; href?: string; to?: string }[] = [
  { label: 'Changelog', to: '/changelog' },
  { label: 'Seedit Gold', to: '/gold' },
  { label: 'Blog', href: 'https://bitsocial.net/blog?q=seedit' },
  { label: 'Docs', href: 'https://bitsocial.net/docs' },
  { label: 'Feedback', href: 'https://github.com/bitsocialnet/seedit/issues/new' },
  { label: 'Contributors', href: 'https://github.com/bitsocialnet/seedit/graphs/contributors' },
  { label: 'Source code', href: 'https://github.com/bitsocialnet/seedit' },
];

/** What Seedit is and how it works, with the links the old interface keeps in its footer. */
const SiteAbout = () => {
  useScrollToTop();
  useEffect(() => {
    document.title = 'About - Seedit';
  }, []);

  return (
    <ModernColumns>
      <header className={styles.header}>
        <h1 className={styles.heading}>About Seedit</h1>
      </header>
      <FAQ classes={{ page: styles.page, toc: styles.toc, list: styles.list }} />
      <section className={styles.page} aria-labelledby='about-links'>
        <h2 id='about-links'>Links</h2>
        <ul className={styles.list}>
          {LINKS.map(({ label, href, to }) => (
            <li key={label}>
              {to ? (
                <Link to={to}>{label}</Link>
              ) : (
                <a href={href} target='_blank' rel='noopener noreferrer'>
                  {label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </ModernColumns>
  );
};

/** A community's about card as its own page, for widths where the community page has no rail. */
const CommunityAbout = () => {
  const { t } = useTranslation();
  useScrollToTop();
  const { communityAddress } = useResolvedCommunityRoute();
  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress) } : undefined);

  useEffect(() => {
    document.title = `${community?.title || communityAddress || t('about')} - Seedit`;
  }, [community?.title, communityAddress, t]);

  return <ModernColumns>{communityAddress && <ModernCommunityAbout community={community} communityAddress={communityAddress} showIdentity />}</ModernColumns>;
};

/**
 * The about routes in the modern interface. The site's /about explains Seedit and a community's shows its about card;
 * the old interface's other about routes only existed to show its sidebar on phones, so they lead to their pages.
 */
const ModernAbout = () => {
  const { pathname, search, hash } = useLocation();
  const { authorAddress, commentCid, communityAddress, directoryCode } = useParams();
  const keep = `${search}${hash}`;

  if (pathname === '/profile/about') return <Navigate to={`/profile${keep}`} replace />;
  if (authorAddress && commentCid) return <Navigate to={`/u/${authorAddress}/comments/${commentCid}${keep}`} replace />;
  if (pathname.startsWith(`${DIRECTORY_INDEX_PATH}/`)) {
    return <Navigate to={`${directoryCode ? getDirectoryCandidatesPath(directoryCode) : DIRECTORY_INDEX_PATH}${keep}`} replace />;
  }
  if (communityAddress && commentCid) return <Navigate to={`/s/${communityAddress}/about${keep}`} replace />;
  if (communityAddress) return <CommunityAbout />;
  return <SiteAbout />;
};

export default ModernAbout;
