import { inject, pageview, track, type BeforeSendEvent } from '@vercel/analytics';
import { getRouteSortType, isValidRouteSortType } from '../../constants/sort-types';
import { resolveCommunityRouteAddress } from '../utils/community-route-utils';
import { isDirectoryCode } from '../utils/directory-codes';
import type { DirectoryList } from '../utils/directory-list-utils';
import { vendoredDirectoryLists } from '../utils/vendored-directory-lists';
import { PROFILE_PAGE_SEGMENTS } from '../utils/view-utils';
import { isAnalyticsEnabled, type PageViewOptions, type PostingAnalyticsEvent, type PostingAnalyticsKind } from './shared';

// Only directory codes from the bundled public directory lists may leave the client. Other community
// addresses, public keys, comment CIDs, author addresses, search text and settings sections stay local.
const publicCommunities = new Map<string, string>();
for (const { directoryCode, communities } of Object.values(vendoredDirectoryLists)) {
  for (const { address, publicKey } of communities) {
    publicCommunities.set(address.toLowerCase(), directoryCode);
    if (publicKey) publicCommunities.set(publicKey, directoryCode);
  }
}

const OTHER_COMMUNITY = 'other';
const NOT_FOUND = '/not-found';
const aggregateFeeds = new Set(['all', 'mod']);

// Lists the app loaded at runtime, set by trackPageView: a directory published after this build has no
// bundled list, so its communities are only known from the list the app fetched for it.
let runtimeDirectoryLists: readonly DirectoryList[] = [];

const findRuntimeDirectoryCode = (address: string): string | undefined => {
  const lowerCaseAddress = address.toLowerCase();
  return runtimeDirectoryLists.find(
    ({ directoryCode, communities }) =>
      isDirectoryCode(directoryCode) && communities.some((community) => community.address.toLowerCase() === lowerCaseAddress || community.publicKey === address),
  )?.directoryCode;
};

const getAnalyticsCommunity = (routeSegment: string): string => {
  if (isDirectoryCode(routeSegment) || aggregateFeeds.has(routeSegment)) return routeSegment;
  if (routeSegment === OTHER_COMMUNITY) return OTHER_COMMUNITY;
  // The route may use the .bso shorthand or the public key; both name the same listed community.
  const address = resolveCommunityRouteAddress(routeSegment) ?? routeSegment;
  return publicCommunities.get(address) ?? publicCommunities.get(address.toLowerCase()) ?? findRuntimeDirectoryCode(address) ?? OTHER_COMMUNITY;
};

// Mirrors ValidFeedRoute and hooks/use-time-filter, which lib cannot import: invalid sort or time
// filter segments render not found at the same URL.
const TOP_TIME_FILTER_NAMES = ['1h', '24h', '1w', '1m', '1y', 'all'];
const isValidFeedSegments = (segments: string[]): boolean => {
  if (segments.length > 2) return false;
  const [sortType, timeFilterName] = segments;
  if (!isValidRouteSortType(sortType)) return false;
  if (!timeFilterName) return true;
  if (getRouteSortType(sortType) === 'top') return TOP_TIME_FILTER_NAMES.includes(timeFilterName);
  return timeFilterName === 'all' || (/^\d+[hdwmy]$/.test(timeFilterName) && parseInt(timeFilterName, 10) > 0);
};

const STATIC_PAGES = new Set(['about', 'changelog', 'gold', 'submit', 'search', 'not-found']);
const SETTINGS_SECTIONS = new Set(['advanced', 'p2p-stats', 'content-options', 'account-data']);
const INBOX_TABS = new Set(['unread', 'commentreplies', 'postreplies']);
const COMMUNITIES_TABS = new Set(['defaults', 'subscriber', 'moderator', 'admin', 'owner', 'create', 'directories']);
const AUTHOR_TABS = new Set(['comments', 'submitted']);

// /s/<community>[/<sort>[/<time filter>]], /s/<community>/comments/<cid>[/about], /s/<community>/{about,submit,settings}.
const getCommunityAnalyticsPath = ([routeSegment, ...rest]: string[]): string => {
  if (!routeSegment) return NOT_FOUND;
  // Community settings are mostly opened by the community's moderators, so they never name the community.
  if (rest[0] === 'settings' && (rest.length === 1 || (rest.length === 2 && rest[1] === 'editor'))) return '/s/community/settings';
  const community = getAnalyticsCommunity(routeSegment);
  if (rest[0] === 'comments') {
    // A sent path (/s/<community>/comments[/about]) maps to itself; comment CIDs are never 'about'.
    if (rest.length === 1 || (rest.length === 2 && rest[1] !== 'about')) return `/s/${community}/comments`;
    if ((rest.length === 2 || rest.length === 3) && rest[rest.length - 1] === 'about') return `/s/${community}/comments/about`;
    return NOT_FOUND;
  }
  if (rest.length === 1 && (rest[0] === 'about' || rest[0] === 'submit')) return `/s/${community}/${rest[0]}`;
  return isValidFeedSegments(rest) ? `/s/${community}` : NOT_FOUND;
};

// /u/<address>/comments[/<cid>][/comments|/submitted][/<sort>[/<time filter>]] and /u/<address>/comments/<cid>/about.
const getAuthorAnalyticsPath = (rest: string[]): string => {
  // A sent path (/u/author[/about|/comments|/submitted]) maps to itself; 'author' is not an author address.
  if (rest[0] === 'author' && (rest.length === 1 || (rest.length === 2 && (rest[1] === 'about' || AUTHOR_TABS.has(rest[1]))))) {
    return rest.length === 1 ? '/u/author' : `/u/author/${rest[1]}`;
  }
  if (rest.length < 2 || rest[1] !== 'comments') return NOT_FOUND;
  const tail = rest.slice(2);
  if (tail.length === 2 && tail[1] === 'about') return '/u/author/about';
  const tabIndex = tail.slice(0, 2).findIndex((segment) => AUTHOR_TABS.has(segment));
  if (tabIndex !== -1) return tail.length - tabIndex - 1 <= 2 ? `/u/author/${tail[tabIndex]}` : NOT_FOUND;
  return tail.length <= 3 ? '/u/author' : NOT_FOUND;
};

const getCommunitiesAnalyticsPath = (rest: string[]): string => {
  if (rest.length === 0) return '/communities';
  if (rest.length === 1 && COMMUNITIES_TABS.has(rest[0])) return `/communities/${rest[0]}`;
  const [section, directoryCode, last] = rest;
  if (section === 'directories') {
    if (rest.length === 2 && directoryCode === 'about') return '/communities/directories/about';
    if (!isDirectoryCode(directoryCode)) return NOT_FOUND;
    if (rest.length === 2) return `/communities/directories/${directoryCode}`;
    return rest.length === 3 && last === 'about' ? `/communities/directories/${directoryCode}/about` : NOT_FOUND;
  }
  // Legacy routes that redirect to the directories: they report as their target, so the redirect is one view.
  if (section === 'vote') {
    if (rest.length === 1 || (rest.length === 2 && (directoryCode === 'passing' || directoryCode === 'rejecting'))) return '/communities/directories';
    return rest.length === 2 && isDirectoryCode(directoryCode) ? `/communities/directories/${directoryCode}` : NOT_FOUND;
  }
  return NOT_FOUND;
};

/** Reduces an app route to its page type, keeping only directory codes. Every result maps to itself. */
export const getAnalyticsPath = (pathname: string): string => {
  let parts: string[];
  try {
    parts = pathname
      .split(/[?#]/, 1)[0]
      .split('/')
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
  } catch {
    return NOT_FOUND;
  }
  const [first, ...rest] = parts;
  if (!first) return '/';
  if (STATIC_PAGES.has(first)) return rest.length === 0 ? `/${first}` : NOT_FOUND;
  switch (first) {
    case 's':
      return getCommunityAnalyticsPath(rest);
    case 'u':
      return getAuthorAnalyticsPath(rest);
    case 'communities':
      return getCommunitiesAnalyticsPath(rest);
    case 'settings':
      return rest.length === 0 || (rest.length === 1 && SETTINGS_SECTIONS.has(rest[0])) ? '/settings' : NOT_FOUND;
    case 'inbox':
      if (rest.length === 0) return '/inbox';
      return rest.length === 1 && INBOX_TABS.has(rest[0]) ? `/inbox/${rest[0]}` : NOT_FOUND;
    case 'profile':
      if (rest.length === 0) return '/profile';
      // Any other segment is an account comment's pending page, which WebAnalytics never sends.
      if (rest.length === 1) return PROFILE_PAGE_SEGMENTS.has(rest[0]) ? `/profile/${rest[0]}` : '/profile/pending';
      return NOT_FOUND;
    case 'domain':
      // The linked site's domain is removed with the sort and time filter.
      return rest.length === 0 || isValidFeedSegments(rest.slice(1)) ? '/domain' : NOT_FOUND;
  }
  // The home feed's sort and time filter segments.
  return isValidFeedSegments(parts) ? '/' : NOT_FOUND;
};

// The SDK attaches the last pageview's route to every custom event, outside beforeSend's reach,
// so the route names the page type without its community. The pageview URL keeps the community.
export const getAnalyticsRoute = (path: string): string => {
  const parts = path.split('/');
  // Checked at send time: codes published after this release are learned while the app runs.
  if (parts[1] === 's' && (parts[2] === OTHER_COMMUNITY || isDirectoryCode(parts[2]))) parts[2] = '[community]';
  else if (parts[1] === 'communities' && parts[2] === 'directories' && isDirectoryCode(parts[3])) parts[3] = '[directory]';
  return parts.join('/');
};

// Automated browsers (navigator.webdriver) are bots, including ones sending a spoofed referrer.
const isAutomatedBrowser = (): boolean => typeof navigator !== 'undefined' && navigator.webdriver === true;

export const sanitizeAnalyticsEvent = (event: BeforeSendEvent): BeforeSendEvent | null => {
  if (!isAnalyticsEnabled() || isAutomatedBrowser()) return null;
  try {
    // Custom events are failed post attempts; their page would name the community the visitor posted to.
    const path = event.type === 'event' ? '/' : getAnalyticsPath(new URL(event.url).pathname);
    return { ...event, url: new URL(path, window.location.origin).href };
  } catch {
    return null;
  }
};

let initialized = false;
const initialize = () => {
  if (initialized) return;
  inject({ disableAutoTrack: true, beforeSend: sanitizeAnalyticsEvent, mode: 'production' });
  initialized = true;
};

let lastPath: string | undefined;
export const trackPageView = (pathname: string, { replace = false, directoryLists }: PageViewOptions = {}): void => {
  if (!isAnalyticsEnabled()) return;
  initialize();
  if (directoryLists) runtimeDirectoryLists = directoryLists;
  const path = getAnalyticsPath(pathname);
  // A redirect that replaces the entry (/ to /hot, a short community address to its full one, a
  // directory code to its community) is the same page, not a second view. Routes are compared, not
  // paths: the community a directory redirects to may be listed under another directory, or none.
  if (replace && lastPath !== undefined && getAnalyticsRoute(path) === getAnalyticsRoute(lastPath)) return;
  lastPath = path;
  pageview({ path, route: getAnalyticsRoute(path) });
};

export const trackPostingEvent = (event: PostingAnalyticsEvent, context: { kind: PostingAnalyticsKind }): void => {
  if (!isAnalyticsEnabled()) return;
  initialize();
  track(event, { kind: context.kind });
};
