import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCanonicalCommunityRoutePathname } from '../lib/utils/community-route-utils';
import { useDirectoryRegistry } from './use-directory-registry';

const useCanonicalCommunityRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { codes, settled } = useDirectoryRegistry();
  const canonicalPathname = getCanonicalCommunityRoutePathname(location.pathname, { codes, settled });

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
