import { type Comment } from '@bitsocial/bitsocial-react-hooks';
import { getDirectoryCodes, isDirectoryCode, type SeeditDirectoryCode } from './directory-codes';
import { DIRECTORY_INDEX_PATH, getDirectoryAboutPath } from './community-route-utils';

export type ParamsType = {
  accountCommentIndex?: string;
  authorAddress?: string;
  commentCid?: string;
  communityAddress?: string;
  directoryCode?: string;
  timeFilterName?: string;
};

export type ViewType = 'home' | 'pending' | 'post' | 'submit' | 'community' | 'community/submit';

const sortTypes = ['/hot', '/new', '/active', '/top'];

/** Components pass `directoryCodes` from useDirectoryRegistry() so the link updates when published codes arrive. */
export const getAboutLink = (pathname: string, params: ParamsType, directoryCodes: readonly SeeditDirectoryCode[] = getDirectoryCodes()): string => {
  // some communities might use emojis in their address, so we need to decode the pathname
  const decodedPathname = decodeURIComponent(pathname);

  if (isCommunitiesDirectoryView(decodedPathname)) {
    return getDirectoryAboutPath(isDirectoryCode(params.directoryCode, directoryCodes) ? params.directoryCode : undefined);
  } else if (decodedPathname.startsWith(`/s/${params.communityAddress}/comments/${params.commentCid}`)) {
    return `/s/${params.communityAddress}/comments/${params.commentCid}/about`;
  } else if (decodedPathname.startsWith(`/s/${params.communityAddress}`)) {
    return `/s/${params.communityAddress}/about`;
  } else if (decodedPathname.startsWith('/profile')) {
    return '/profile/about';
  } else if (decodedPathname.startsWith('/u/')) {
    return `/u/${params.authorAddress}/comments/${params.commentCid}/about`;
  } else if (decodedPathname.startsWith('/s/all')) {
    return '/s/all/about';
  } else {
    return '/about';
  }
};

export const isAllView = (pathname: string): boolean => {
  return pathname === '/s/all' || pathname.startsWith('/s/all/');
};

export const isAllAboutView = (pathname: string): boolean => {
  return pathname === '/s/all/about';
};

export const isAuthorView = (pathname: string): boolean => {
  return pathname.startsWith('/u/');
};

export const isAuthorCommentsView = (pathname: string, params: ParamsType): boolean => {
  return pathname === `/u/${params.authorAddress}/comments/${params.commentCid}/comments`;
};

export const isAuthorSubmittedView = (pathname: string, params: ParamsType): boolean => {
  return pathname === `/u/${params.authorAddress}/comments/${params.commentCid}/submitted`;
};

export const isChangelogView = (pathname: string): boolean => {
  return pathname === '/changelog' || pathname.startsWith('/changelog#');
};

export const isCreateCommunityView = (pathname: string): boolean => {
  return pathname === '/communities/create';
};

export const isDomainView = (pathname: string): boolean => {
  return pathname.startsWith('/domain/');
};

export const isSearchView = (pathname: string): boolean => {
  // the router tolerates a trailing slash on the route, so the view flag must too
  return pathname === '/search' || pathname === '/search/';
};

export const isGoldView = (pathname: string): boolean => {
  return pathname === '/gold' || pathname.startsWith('/gold#');
};

export const isHomeView = (pathname: string): boolean => {
  if (pathname === '/') return true;

  const pathParts = pathname.split('/');
  if (pathParts.length >= 2) {
    const potentialSortType = '/' + pathParts[1];
    return sortTypes.includes(potentialSortType);
  }

  return false;
};

export const isHomeAboutView = (pathname: string): boolean => {
  return pathname === '/about' || pathname.startsWith('/about#');
};

export const isInboxView = (pathname: string): boolean => {
  return pathname.startsWith('/inbox');
};

export const isInboxCommentRepliesView = (pathname: string): boolean => {
  return pathname === `/inbox/commentreplies`;
};

export const isInboxPostRepliesView = (pathname: string): boolean => {
  return pathname === `/inbox/postreplies`;
};

export const isInboxUnreadView = (pathname: string): boolean => {
  return pathname === `/inbox/unread`;
};

export const isModView = (pathname: string): boolean => {
  return pathname === `/s/mod` || pathname.startsWith(`/s/mod/`);
};

export const isPendingPostView = (pathname: string, params: ParamsType): boolean => {
  return pathname === `/profile/${params.accountCommentIndex}`;
};

/** The /profile/<page> routes; any other /profile/<segment> is the pending page of an account comment. */
export const PROFILE_PAGE_SEGMENTS: ReadonlySet<string> = new Set(['about', 'upvoted', 'downvoted', 'hidden', 'saved', 'comments', 'submitted']);

/** Like isPendingPostView, for code outside the routes, which has no route params. Routes match regardless of case. */
export const isPendingPostPath = (pathname: string): boolean => {
  const segment = pathname.match(/^\/profile\/([^/]+)\/?$/i)?.[1];
  return segment !== undefined && !PROFILE_PAGE_SEGMENTS.has(segment.toLowerCase());
};

export interface RenderedPendingPost {
  accountCommentIndex?: string;
  key?: string;
}

// a pending account comment has no cid yet; its publish timestamp and community identify it across
// the reindexing that happens when an earlier account comment is deleted
export const getPendingPostKey = (accountComment?: Comment): string | undefined =>
  accountComment?.timestamp === undefined ? undefined : `${accountComment.communityAddress ?? ''}:${accountComment.timestamp}`;

// abandoning a pending post deletes its account comment, so the post page that rendered it must go back
// instead of showing not found, also when a later account comment shifted into the same index
export const getPendingPostRedirect = (
  rendered: RenderedPendingPost,
  current: RenderedPendingPost,
  isValidAccountCommentIndex: boolean,
): 'back' | 'not-found' | undefined => {
  const wasRenderedHere = rendered.key !== undefined && rendered.accountCommentIndex === current.accountCommentIndex;
  if (isValidAccountCommentIndex && !(wasRenderedHere && rendered.key !== current.key)) {
    return undefined;
  }
  return wasRenderedHere ? 'back' : 'not-found';
};

export const isPostPageView = (pathname: string, params: ParamsType): boolean => {
  // some communities might use emojis in their address, so we need to decode the pathname
  const decodedPathname = decodeURIComponent(pathname);
  return params.communityAddress && params.commentCid ? decodedPathname.startsWith(`/s/${params.communityAddress}/comments/${params.commentCid}`) : false;
};

export const isPostPageAboutView = (pathname: string, params: ParamsType): boolean => {
  return params.communityAddress && params.commentCid ? pathname.startsWith(`/s/${params.communityAddress}/comments/${params.commentCid}/about`) : false;
};

export const isPostContextView = (pathname: string, params: ParamsType, search: string): boolean => {
  if (!params.communityAddress || !params.commentCid) return false;

  const decodedPathname = decodeURIComponent(pathname);
  const expectedPathBase = `/s/${params.communityAddress}/comments/${params.commentCid}`;

  if (!decodedPathname.startsWith(expectedPathBase)) return false;

  const searchParams = new URLSearchParams(search);
  const context = searchParams.get('context');

  return context !== null && !isNaN(Number(context));
};

export const isProfileView = (pathname: string): boolean => {
  return pathname.startsWith(`/profile`);
};

export const isProfileCommentsView = (pathname: string): boolean => {
  return pathname.startsWith('/profile/comments');
};

export const isProfileSubmittedView = (pathname: string): boolean => {
  return pathname.startsWith('/profile/submitted');
};

export const isProfileDownvotedView = (pathname: string): boolean => {
  return pathname === '/profile/downvoted';
};

export const isProfileUpvotedView = (pathname: string): boolean => {
  return pathname === '/profile/upvoted';
};

export const isProfileHiddenView = (pathname: string): boolean => {
  return pathname === '/profile/hidden';
};

export const isProfileSavedView = (pathname: string): boolean => {
  return pathname === '/profile/saved';
};

export const isSettingsView = (pathname: string): boolean => {
  return (
    pathname === '/settings' ||
    pathname === '/settings/advanced' ||
    pathname === '/settings/p2p-stats' ||
    pathname === '/settings/content-options' ||
    (import.meta.env.DEV && pathname === '/settings/debug') ||
    pathname === '/settings/account-data'
  );
};

export const isSettingsAdvancedView = (pathname: string): boolean => {
  return pathname === '/settings/advanced';
};

export const isSettingsP2pStatsView = (pathname: string): boolean => {
  return pathname === '/settings/p2p-stats';
};

export const isSettingsContentOptionsView = (pathname: string): boolean => {
  return pathname === '/settings/content-options';
};

export const isSettingsDebugView = (pathname: string): boolean => {
  return import.meta.env.DEV && pathname === '/settings/debug';
};

export const isSettingsAccountDataView = (pathname: string): boolean => {
  return pathname === '/settings/account-data';
};

export const isSubmitView = (pathname: string): boolean => {
  return pathname.endsWith('/submit');
};

export const isCommunityView = (pathname: string, params: ParamsType): boolean => {
  // some communities might use emojis in their address, so we need to decode the pathname
  const decodedPathname = decodeURIComponent(pathname);
  return params.communityAddress ? decodedPathname.startsWith(`/s/${params.communityAddress}`) : false;
};

export const isCommunityAboutView = (pathname: string, params: ParamsType): boolean => {
  return params.communityAddress ? pathname.startsWith(`/s/${params.communityAddress}/about`) : false;
};

export const isCommunitySettingsView = (pathname: string, params: ParamsType): boolean => {
  return params.communityAddress ? pathname === `/s/${params.communityAddress}/settings` || pathname === `/s/${params.communityAddress}/settings/editor` : false;
};

export const isCommunitySubmitView = (pathname: string, params: ParamsType): boolean => {
  return params.communityAddress ? pathname === `/s/${params.communityAddress}/submit` : false;
};

export const isCommunitiesView = (pathname: string): boolean => {
  return pathname.startsWith('/communities');
};

export const isCommunitiesSubscriberView = (pathname: string): boolean => {
  return pathname === '/communities/subscriber';
};

export const isCommunitiesModeratorView = (pathname: string): boolean => {
  return pathname === '/communities/moderator';
};

export const isCommunitiesAdminView = (pathname: string): boolean => {
  return pathname === '/communities/admin';
};

export const isCommunitiesOwnerView = (pathname: string): boolean => {
  return pathname === '/communities/owner';
};

export const isCommunitiesDirectoryView = (pathname: string): boolean => {
  return pathname === DIRECTORY_INDEX_PATH || pathname.startsWith(`${DIRECTORY_INDEX_PATH}/`);
};

export const isCommunitiesDirectoryAboutView = (pathname: string): boolean => {
  return isCommunitiesDirectoryView(pathname) && pathname.endsWith('/about');
};
