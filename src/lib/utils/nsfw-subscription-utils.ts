import { setAccount } from '@bitsocial/bitsocial-react-hooks';
import type { DefaultSubscription } from './starter-community-list';

const NSFW_SUBSCRIPTION_PROMPT_KEY = 'seedit-nsfw-subscription-prompt-shown';

export interface NSFWSubscriptionOptions {
  account: any;
  defaultCommunities: DefaultSubscription[];
}

export const handleNSFWSubscriptionPrompt = async ({ account, defaultCommunities }: NSFWSubscriptionOptions): Promise<void> => {
  if (localStorage.getItem(NSFW_SUBSCRIPTION_PROMPT_KEY) || !account || !defaultCommunities.length) {
    return;
  }

  const communitiesToSubscribe = defaultCommunities.filter((sub) => sub.nsfw).map((sub) => sub.address);

  if (communitiesToSubscribe.length === 0) {
    return;
  }

  const confirmMessage = `You're now showing NSFW communities. Would you like to subscribe to these communities? This will add them to your subscriptions.`;

  const shouldSubscribe = window.confirm(confirmMessage);

  // Mark as shown regardless of user choice
  localStorage.setItem(NSFW_SUBSCRIPTION_PROMPT_KEY, 'true');

  if (shouldSubscribe) {
    try {
      const currentSubscriptions = account.subscriptions || [];
      const newSubscriptions = [...new Set([...currentSubscriptions, ...communitiesToSubscribe])];

      await setAccount({
        ...account,
        subscriptions: newSubscriptions,
      });
    } catch (error) {
      console.error('Error subscribing to NSFW communities:', error);
    }
  }
};
