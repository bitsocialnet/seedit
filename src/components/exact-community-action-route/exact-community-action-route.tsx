import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useResolvedCommunityRoute from '../../hooks/use-resolved-community-route';
import ErrorDisplay from '../error-display';
import NotFound from '../not-found';
import { getExactCommunityActionRedirectPath } from '../../lib/utils/community-route-utils';

interface ExactCommunityActionRouteProps {
  children: ReactNode;
}

/** Mutable directory aliases are read-only entry routes; action routes must expose an exact target. */
const ExactCommunityActionRoute = ({ children }: ExactCommunityActionRouteProps) => {
  const { directoryCode, communityAddress, isResolving, error } = useResolvedCommunityRoute();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!directoryCode || !communityAddress) return;
    const redirectPath = getExactCommunityActionRedirectPath(pathname, directoryCode, communityAddress, search, hash);
    if (redirectPath) navigate(redirectPath, { replace: true });
  }, [communityAddress, directoryCode, hash, navigate, pathname, search]);

  // Render nothing until the target is exact: a directory alias redirects, and an unsettled code may still become one.
  if (isResolving || (directoryCode && communityAddress)) return null;
  // A directory with no winner has no exact target. A directory published after this build has no bundled list,
  // so a failed list request ends here too.
  if (directoryCode) return error ? <ErrorDisplay error={error} /> : <NotFound />;
  return children;
};

export default ExactCommunityActionRoute;
