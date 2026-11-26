import { useMemo } from 'react';
import { useAccountCommunities } from '@bitsocial/bitsocial-react-hooks';
import useFeedRoute from './use-feed-route';

/** The s/mod feed: posts from every community the account moderates; both interfaces' s/mod pages use it. */
const useModFeed = () => {
  const { accountCommunities } = useAccountCommunities();
  const communityAddresses = useMemo(() => Object.keys(accountCommunities ?? {}), [accountCommunities]);
  return { ...useFeedRoute(communityAddresses), communityAddresses };
};

export default useModFeed;
