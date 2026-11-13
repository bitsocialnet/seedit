import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCanonicalCommunityRoutePathname } from '../lib/utils/community-route-utils';
import { useDirectoryRegistry } from './use-directory-registry';

const useCanonicalCommunityRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { codes, status } = useDirectoryRegistry();
  // The rewrite replaces the URL for good, so a well-formed unknown code keeps its route until this page load has read
  // the published directories; after a failed request the route still resolves to `<code>.bso`, unrewritten.
  const canonicalPathname = getCanonicalCommunityRoutePathname(location.pathname, { codes, settled: status === 'published' });

  useEffect(() => {
    if (!canonicalPathname) return;

    navigate(
      {
        pathname: canonicalPathname,
        search: location.search,
        hash: location.hash,
      },
      { replace: true },
    );
  }, [canonicalPathname, location.hash, location.search, navigate]);
};

export default useCanonicalCommunityRoute;
