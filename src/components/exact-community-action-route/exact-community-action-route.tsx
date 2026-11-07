import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useResolvedCommunityRoute from '../../hooks/use-resolved-community-route';
import { getExactCommunityActionRedirectPath } from '../../lib/utils/community-route-utils';

interface ExactCommunityActionRouteProps {
  children: ReactNode;
}

/** Mutable directory aliases are read-only entry routes; action routes must expose an exact target. */
const ExactCommunityActionRoute = ({ children }: ExactCommunityActionRouteProps) => {
  const { directoryCode, communityAddress, isResolving } = useResolvedCommunityRoute();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!directoryCode || !communityAddress) return;
    const redirectPath = getExactCommunityActionRedirectPath(pathname, directoryCode, communityAddress, search, hash);
    if (redirectPath) navigate(redirectPath, { replace: true });
  }, [communityAddress, directoryCode, hash, navigate, pathname, search]);

  // Render nothing until the target is exact: a directory alias redirects, and an unsettled code may still become one.
  return directoryCode || isResolving ? null : children;
};

export default ExactCommunityActionRoute;
