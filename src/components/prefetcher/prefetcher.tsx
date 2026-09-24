import { useComment, useCommunity } from '@bitsocial/bitsocial-react-hooks';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import usePrefetchStore from '../../stores/use-prefetch-store';

// Subscribes to the hovered post (and its community) or community with the hooks their pages use.
// The page's own hooks join the same store entries on navigation, so the updates started here carry over.
const Prefetcher = () => {
  const commentCid = usePrefetchStore((state) => state.commentCid);
  const communityAddress = usePrefetchStore((state) => state.communityAddress);
  useComment({ commentCid });
  useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress) } : undefined);
  return null;
};

export default Prefetcher;
