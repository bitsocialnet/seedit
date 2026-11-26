import { useEffect, useMemo, useState } from 'react';
import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import { linkMatchesDomain } from '../lib/utils/url-utils';
import { useDefaultSubscriptionAddresses } from './use-default-subscriptions';
import useFeedRoute from './use-feed-route';

const NO_RESULTS_DELAY_MS = 2000;

/**
 * The /domain/:domain feed: posts across the default communities that link to a domain or its subdomains; both
 * interfaces' domain pages use it. A filtered feed can stay empty while it keeps looking, so `showNoResults` turns on
 * once a request has stayed empty for two seconds.
 */
const useDomainFeed = (domain: string | undefined) => {
  const communityAddresses = useDefaultSubscriptionAddresses();
  const filter = useMemo(() => ({ filter: (comment: Comment) => linkMatchesDomain(comment?.link, domain), key: `domain-filter-${domain}` }), [domain]);
  const feedRoute = useFeedRoute(communityAddresses, filter);
  const { feed, requestKey } = feedRoute;

  const [noResultsRequestKey, setNoResultsRequestKey] = useState<string>();
  const isFeedEmpty = Boolean(domain) && feed?.length === 0;
  useEffect(() => {
    if (!isFeedEmpty) return;
    const timer = setTimeout(() => setNoResultsRequestKey(requestKey), NO_RESULTS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isFeedEmpty, requestKey]);
  const showNoResults = isFeedEmpty && noResultsRequestKey === requestKey;
  // forget a finished delay once its request is replaced or its feed fills, so the next empty feed waits again
  if (noResultsRequestKey !== undefined && !showNoResults) setNoResultsRequestKey(undefined);

  return { ...feedRoute, communityAddresses, showNoResults };
};

export default useDomainFeed;
