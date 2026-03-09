import { setAccount } from '@bitsocialnet/bitsocial-react-hooks';

const NSFW_SUBSCRIPTION_PROMPT_KEY_PREFIX = 'seedit-nsfw-subscription-prompt-shown-';

export interface NSFWSubscriptionOptions {
  account: any;
  defaultSubplebbits: any[];
  tagsToShow: string[];
  isShowingAll?: boolean;
}

const getPromptKey = (tagsToShow: string[], isShowingAll: boolean): string => {
  if (isShowingAll) {
    return `${NSFW_SUBSCRIPTION_PROMPT_KEY_PREFIX}all`;
  }
  // Sort tags to ensure consistent key regardless of order
  const sortedTags = [...tagsToShow].sort();
  return `${NSFW_SUBSCRIPTION_PROMPT_KEY_PREFIX}${sortedTags.join('-')}`;
};

export const shouldShowNSFWSubscriptionPrompt = (tagsToShow: string[], isShowingAll: boolean = false): boolean => {
  const key = getPromptKey(tagsToShow, isShowingAll);
  return !localStorage.getItem(key);
};

export const markNSFWSubscriptionPromptShown = (tagsToShow: string[], isShowingAll: boolean = false): void => {
  const key = getPromptKey(tagsToShow, isShowingAll);
  localStorage.setItem(key, 'true');
};

export const getCommunitiesWithTags = (defaultSubplebbits: any[], tags: string[]): string[] => {
  return defaultSubplebbits
    .filter((sub) => {
      const subTags = sub.tags || [];
      return tags.some((tag) => subTags.includes(tag));
    })
    .map((sub) => sub.address);
};

export const handleNSFWSubscriptionPrompt = async ({ account, defaultSubplebbits, tagsToShow, isShowingAll = false }: NSFWSubscriptionOptions): Promise<void> => {
  if (!shouldShowNSFWSubscriptionPrompt(tagsToShow, isShowingAll) || !account || !defaultSubplebbits.length) {
    return;
  }

  const communitiesToSubscribe = getCommunitiesWithTags(defaultSubplebbits, tagsToShow);

  if (communitiesToSubscribe.length === 0) {
    return;
  }

  const tagText = isShowingAll
    ? 'all NSFW communities'
    : tagsToShow.length === 1
      ? `communities tagged as "${tagsToShow[0]}"`
      : `communities tagged as: ${tagsToShow.join(', ')}`;

  const confirmMessage = `You're now showing ${tagText}. Would you like to subscribe to these communities? This will add them to your subscriptions.`;

  const shouldSubscribe = window.confirm(confirmMessage);

  // Mark as shown regardless of user choice
  markNSFWSubscriptionPromptShown(tagsToShow, isShowingAll);

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
