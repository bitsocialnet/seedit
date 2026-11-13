export type SubscriptionState = 'loading' | 'noSubscriptions' | 'hasSubscriptions';

interface HomeSubscriptionStateInput {
  subscriptionCount: number;
  feedLength: number | undefined;
  isCheckingSubscriptions: boolean;
  safeToShowNoSubscriptions: boolean;
}

export const getHomeSubscriptionState = ({
  subscriptionCount,
  feedLength,
  isCheckingSubscriptions,
  safeToShowNoSubscriptions,
}: HomeSubscriptionStateInput): SubscriptionState => {
  if (subscriptionCount > 0 || (feedLength !== undefined && feedLength > 0)) return 'hasSubscriptions';
  if (!isCheckingSubscriptions && feedLength === 0 && safeToShowNoSubscriptions) return 'noSubscriptions';
  return 'loading';
};
