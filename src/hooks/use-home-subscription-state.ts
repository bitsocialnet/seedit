import { useEffect, useState } from 'react';
import { useAccount } from '@bitsocial/bitsocial-react-hooks';
import { getHomeSubscriptionState, type SubscriptionState } from '../lib/utils/home-subscription-state';
import { useAutoSubscribeStore } from '../stores/use-auto-subscribe-store';
import { useStarterCommunityList } from './use-default-subscriptions';

/** Whether the home feed is loading, has subscriptions, or should invite the account to join its first community. */
const useHomeSubscriptionState = (feedLength: number | undefined): SubscriptionState => {
  const account = useAccount();
  const { isCheckingAccount } = useAutoSubscribeStore();
  const { loading: starterListLoading } = useStarterCommunityList();
  const accountAddress = account?.author?.address;
  const isCheckingSubscriptions = starterListLoading || !accountAddress || isCheckingAccount(accountAddress);

  // wait 800ms after each subscription check settles before showing "no subscriptions"
  const [safeToShowNoSubscriptions, setSafeToShowNoSubscriptions] = useState(false);
  if (isCheckingSubscriptions && safeToShowNoSubscriptions) {
    setSafeToShowNoSubscriptions(false);
  }

  useEffect(() => {
    if (isCheckingSubscriptions) return;

    const timeout = setTimeout(() => setSafeToShowNoSubscriptions(true), 800);
    return () => clearTimeout(timeout);
  }, [isCheckingSubscriptions, accountAddress]);

  return getHomeSubscriptionState({
    subscriptionCount: account?.subscriptions?.length ?? 0,
    feedLength,
    isCheckingSubscriptions,
    safeToShowNoSubscriptions,
  });
};

export default useHomeSubscriptionState;
