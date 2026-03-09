import { Role, Subplebbit, Comment } from '@bitsocialnet/bitsocial-react-hooks';

export type Roles = { [address: string]: Role };

export const isUserOwner = (roles: Roles | undefined, userAddress: string | undefined): boolean => {
  if (!roles || !userAddress) return false;
  return roles[userAddress]?.role === 'owner';
};

export const isUserOwnerOrAdmin = (roles: Roles | undefined, userAddress: string | undefined): boolean => {
  if (!roles || !userAddress) return false;
  const userRole = roles[userAddress]?.role;
  return userRole === 'owner' || userRole === 'admin';
};

export const findSubplebbitCreator = (roles: Roles | undefined): string => {
  if (!roles) {
    return 'anonymous';
  }

  const owner = Object.keys(roles).find((key) => roles[key].role === 'owner');
  if (owner) {
    return owner;
  }

  return 'anonymous';
};

export const findAuthorSubplebbits = (authorAddress: string | undefined, subplebbits: (Subplebbit | undefined)[]): string[] => {
  let authorSubplebbits: string[] = [];

  if (!authorAddress || !subplebbits) {
    return [];
  }

  subplebbits.forEach((subplebbit) => {
    if (subplebbit && subplebbit.roles?.[authorAddress]) {
      authorSubplebbits.push(subplebbit.address);
    }
  });

  return authorSubplebbits;
};

interface Score {
  postScore: number;
  replyScore: number;
}

export const estimateAuthorKarma = (accountComments: (Comment | undefined)[]): Score => {
  let postScore = 0;
  let replyScore = 0;

  accountComments.forEach((comment) => {
    if (comment) {
      // Ensure upvoteCount and downvoteCount are treated as numbers, defaulting to 0 if null or undefined
      const upvotes = comment.upvoteCount ?? 0;
      const downvotes = comment.downvoteCount ?? 0;
      const score = upvotes - downvotes;

      if (comment.parentCid) {
        replyScore += score;
      } else {
        postScore += score;
      }
    }
  });

  return { postScore, replyScore };
};
