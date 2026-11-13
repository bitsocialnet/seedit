import { describe, expect, it } from 'vitest';
import { getHomeSubscriptionState } from './home-subscription-state';

describe('getHomeSubscriptionState', () => {
  it('keeps an empty home loading while default subscriptions are still being checked', () => {
    expect(
      getHomeSubscriptionState({
        subscriptionCount: 0,
        feedLength: 0,
        isCheckingSubscriptions: true,
        safeToShowNoSubscriptions: true,
      }),
    ).toBe('loading');
  });

  it('shows the empty state only after subscription checks and the safety delay finish', () => {
    expect(
      getHomeSubscriptionState({
        subscriptionCount: 0,
        feedLength: 0,
        isCheckingSubscriptions: false,
        safeToShowNoSubscriptions: true,
      }),
    ).toBe('noSubscriptions');
  });
});
