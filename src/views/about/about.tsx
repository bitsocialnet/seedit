import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useIsMobile from '../../hooks/use-is-mobile';
import Sidebar from '../../components/sidebar';
import FAQ from '../../components/faq';
import pageStyles from '../../components/static-page';
import { useComment, useCommunity } from '@bitsocial/bitsocial-react-hooks';
import { isHomeAboutView } from '../../lib/utils/view-utils';
import { useEffect } from 'react';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useResolvedCommunityRoute from '../../hooks/use-resolved-community-route';
import {
  getCanonicalCommunityPostAboutRedirectPath,
  getCanonicalCommunityPostRedirectPath,
  getCommunityPath,
  getCommunityPostPath,
} from '../../lib/utils/community-route-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';

const About = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname, search, hash } = location;
  const isInHomeAboutView = isHomeAboutView(pathname);
  const { commentCid, communityAddress: routeCommunitySegment } = useParams();
  const { communityAddress } = useResolvedCommunityRoute();

  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress) } : undefined);
  const comment = useComment({ commentCid: commentCid as string });
  const postCommunityAddress = getCommentCommunityAddress(comment);

  useEffect(() => {
    if (commentCid && postCommunityAddress) {
      const canonicalPostPath = isMobile
        ? getCanonicalCommunityPostAboutRedirectPath(routeCommunitySegment, postCommunityAddress, commentCid)
        : getCanonicalCommunityPostRedirectPath(routeCommunitySegment, postCommunityAddress, commentCid);
      if (canonicalPostPath) {
        navigate(`${canonicalPostPath}${search}${hash}`, { replace: true });
        return;
      }
    }
    if (!isMobile && pathname.endsWith('/about') && !isInHomeAboutView) {
      const newPath = communityAddress
        ? commentCid
          ? getCommunityPostPath(communityAddress, commentCid)
          : getCommunityPath(communityAddress)
        : pathname.replace(/\/about$/, '') || '/';
      navigate(`${newPath}${search}${hash}`, { replace: true });
    }
  }, [commentCid, communityAddress, hash, isMobile, isInHomeAboutView, navigate, pathname, postCommunityAddress, routeCommunitySegment, search]);

  return (
    <div className={pageStyles.content}>
      {isMobile ? (
        isInHomeAboutView ? (
          <>
            <Sidebar comment={comment} community={community} />
          </>
        ) : (
          <Sidebar comment={comment} community={community} />
        )
      ) : (
        <>
          <Sidebar />
          <FAQ />
        </>
      )}
    </div>
  );
};

export default About;
