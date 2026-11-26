import { useLocation, useParams } from 'react-router-dom';
import { useAccount, useAccountComments, useAccountCommunities, useAuthor, useAuthorComments, useBlock, useCommunities } from '@bitsocial/bitsocial-react-hooks';
import { getOldestAccountHistoryTimestamp } from '../lib/utils/account-history-utils';
import { stripTripcodeProof } from '../lib/utils/tripcode-utils';
import { estimateAuthorKarma, findAuthorCommunities } from '../lib/utils/user-utils';
import { isAuthorView, isProfileView } from '../lib/utils/view-utils';
import { getCommunityIdentifiers } from './use-community-identifier';
import { useDefaultSubscriptionAddresses } from './use-default-subscriptions';

/**
 * Who a profile page shows: another author on /u/ routes, or the account on /profile routes.
 * Both interfaces' profile pages read it, so karma, age, and moderated communities agree.
 */
const useAuthorProfile = () => {
  const location = useLocation();
  const { authorAddress, commentCid } = useParams();
  const isInAuthorView = isAuthorView(location.pathname);
  const isInProfileView = isProfileView(location.pathname);
  const { blocked, unblock, block } = useBlock({ address: authorAddress });

  const account = useAccount();
  const { accountComments: oldestAccountComment } = useAccountComments({ page: 0, pageSize: 1, order: 'asc' });
  const { accountCommunities } = useAccountCommunities();
  const profileOldestAccountTimestamp = getOldestAccountHistoryTimestamp(oldestAccountComment as { timestamp?: number }[]);

  // An author's moderated communities are found among the communities already cached for this account.
  const defaultCommunityAddresses = useDefaultSubscriptionAddresses();
  const subscriptionsAndDefaults = [...(account?.subscriptions || []), ...defaultCommunityAddresses];
  const communities =
    useCommunities({
      communities: getCommunityIdentifiers(subscriptionsAndDefaults),
      onlyIfCached: true,
    }).communities?.filter(Boolean) || [];

  const authorAccount = useAuthor({ authorAddress, commentCid });
  const { authorComments } = useAuthorComments({ authorAddress, commentCid });
  const authorOldestCommentTimestamp = authorComments?.length
    ? Math.min(...authorComments.filter((comment): comment is NonNullable<typeof comment> => comment != null).map((comment) => comment.timestamp))
    : Date.now();
  const authorCommunities = findAuthorCommunities(authorAddress, Object.values(communities));

  const address = isInAuthorView ? authorAddress : isInProfileView ? account?.author?.address : '';
  const karma = isInAuthorView ? estimateAuthorKarma(authorComments) : isInProfileView ? account?.karma : undefined;
  const { postScore, replyScore } = karma || { postScore: 0, replyScore: 0 };
  const oldestCommentTimestamp = isInAuthorView ? authorOldestCommentTimestamp : isInProfileView ? profileOldestAccountTimestamp : Date.now();
  const displayName = stripTripcodeProof(isInAuthorView ? authorAccount?.author?.displayName : isInProfileView ? account?.author?.displayName : '');
  const shortAddress: string | undefined = isInAuthorView ? authorAccount?.author?.shortAddress : account?.author?.shortAddress;
  const moderatedCommunities = [...new Set(isInAuthorView ? authorCommunities : Object.keys(accountCommunities))];

  return {
    address,
    shortAddress,
    displayName,
    /** Post karma counts from 1, as on old Reddit. */
    postKarma: postScore + 1,
    commentKarma: replyScore,
    oldestCommentTimestamp,
    moderatedCommunities,
    isInAuthorView,
    isInProfileView,
    /** Another author's page, which the account can block. */
    isOtherAuthor: Boolean(isInAuthorView && authorAddress !== account?.author?.address),
    blocked,
    block,
    unblock,
  };
};

export default useAuthorProfile;
