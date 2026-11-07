import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { getLoadedDirectoryLists } from '../../hooks/use-directory-list';
import { trackPageView } from '../../lib/analytics';
import { isPendingPostPath } from '../../lib/utils/view-utils';

const WebAnalytics = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousPathname.current;
    if (previous === pathname) return;
    previousPathname.current = pathname;
    // Submitting a post opens its pending page (/profile/<index>), which redirects to the post once
    // the community accepts it. Neither view is sent: their timing would reveal when this visitor posted.
    if (isPendingPostPath(pathname) || (previous !== null && isPendingPostPath(previous))) return;
    // Compare the actual route locally so two different posts still count as
    // two views, while only their shared, sanitized page name is transmitted.
    // A directory published after this build is only known from its loaded list, which a redirect to
    // its community has already read.
    trackPageView(pathname, { replace: navigationType === 'REPLACE', directoryLists: getLoadedDirectoryLists() });
  }, [navigationType, pathname]);

  return null;
};

export default WebAnalytics;
