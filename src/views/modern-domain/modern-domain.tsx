import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import useDomainFeed from '../../hooks/use-domain-feed';
import ModernFeed, { ModernFeedHeader } from '../../components/modern-feed';
import { ExternalLinkIcon } from '../../components/modern-icons';
import { ModernColumns } from '../../components/modern-layout';
import styles from './modern-domain.module.css';

/** Posts across the default communities that link to a domain or its subdomains. */
const ModernDomain = () => {
  const { domain } = useParams<{ domain?: string }>();
  const { feed, hasMore, loadMore, reset, sortType, timeFilterName, sessionKey, redirectPath, communityAddresses, showNoResults } = useDomainFeed(domain);

  useEffect(() => {
    document.title = `${domain} - Seedit`;
  }, [domain]);

  if (redirectPath) return <Navigate to={redirectPath} replace />;

  return (
    <ModernColumns>
      <ModernFeedHeader title={domain} description={`Posts linking to ${domain} from the default communities.`}>
        <a href={`https://${domain}`} target='_blank' rel='noopener noreferrer' className={styles.visit}>
          {domain}
          <ExternalLinkIcon size={14} />
        </a>
      </ModernFeedHeader>
      {showNoResults ? (
        <p className={styles.empty}>No posts found from {domain}</p>
      ) : (
        <ModernFeed
          basePath={`/domain/${domain}`}
          communityAddresses={communityAddresses}
          feed={feed}
          hasMore={hasMore}
          loadMore={loadMore}
          reset={reset}
          sessionKey={sessionKey}
          sortType={sortType}
          timeFilterName={timeFilterName}
        />
      )}
    </ModernColumns>
  );
};

export default ModernDomain;
