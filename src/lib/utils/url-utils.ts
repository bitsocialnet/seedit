import { copyToClipboard } from './clipboard-utils';
import {
  getCanonicalCommunityRoutePathname,
  getCommunityPostUrl,
  getCommunityReferencePath,
  getCommunityReferencePostPath,
  resolveCommunityRouteAddress,
} from './community-route-utils';
import type { KnownDirectoryCodes } from './directory-codes';

export const getHostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export const isValidURL = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const copyShareLinkToClipboard = async (communityAddress: string, cid: string) => {
  const shareLink = getCommunityPostUrl(communityAddress, cid);
  await copyToClipboard(shareLink);
};

const SEEDIT_HOSTNAMES = ['seedit.app', 's.seedit.app', 'seedit.eth.limo', 'seedit.eth.link', 'seedit.eth.sucks', 'seedit.netlify.app', 'pleb.bz'];

// Check if a URL is a valid seedit link that should be handled internally
export const isSeeditLink = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, '');

    if (!SEEDIT_HOSTNAMES.includes(hostname)) {
      return false;
    }

    // Check both pathname and hash for the route pattern
    let routePath = parsedUrl.pathname;

    // If there's a hash that starts with #/, use that as the route path
    if (parsedUrl.hash && parsedUrl.hash.startsWith('#/')) {
      routePath = parsedUrl.hash.substring(1); // Remove the # to get the path
    }

    // For pleb.bz, only support the exact sharelink format without redirect parameter
    if (hostname === 'pleb.bz') {
      // Don't treat as internal if there's a redirect parameter
      if (parsedUrl.searchParams.has('redirect')) {
        return false;
      }
      // Must match exactly: /s/{communityAddress}/comments/{cid}
      return /^\/s\/[^/]+\/comments\/[^/]+$/.test(routePath);
    }

    // For other seedit hostnames, support:
    // - /s/{communityAddress}
    // - /s/{communityAddress}/comments/{commentCid}
    return /^\/s\/[^/]+(\/comments\/[^/]+)?$/.test(routePath);
  } catch {
    return false;
  }
};

// Transform a valid seedit URL to an internal route. Components pass the registry's codes (see getCanonicalCommunityRoutePathname).
export const transformSeeditLinkToInternal = (url: string, knownDirectoryCodes?: KnownDirectoryCodes): string | null => {
  if (!isSeeditLink(url)) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);

    // Check if this is a hash-based route
    if (parsedUrl.hash && parsedUrl.hash.startsWith('#/')) {
      // Extract the route from the hash, preserving any query params within the hash
      const hashPath = parsedUrl.hash.substring(1); // Remove the #
      return getCanonicalCommunityRoutePathname(hashPath, knownDirectoryCodes) ?? hashPath;
    }

    // For regular pathname-based routes
    return (getCanonicalCommunityRoutePathname(parsedUrl.pathname, knownDirectoryCodes) ?? parsedUrl.pathname) + parsedUrl.search + parsedUrl.hash;
  } catch {
    return null;
  }
};

// Check if a string is a valid IPNS public key (52 chars starting with 12D3KooW)
const isValidIPNSKey = (str: string): boolean => {
  return str.length === 52 && str.startsWith('12D3KooW');
};

// Check if a string is a valid domain (contains a dot)
const isValidDomain = (str: string): boolean => {
  return str.includes('.') && str.split('.').length >= 2 && str.split('.').every((part) => part.length > 0);
};

const isValidCommunityReference = (value: string): boolean => {
  if (isValidDomain(value) || isValidIPNSKey(value)) return true;
  const resolvedAddress = resolveCommunityRouteAddress(value);
  return resolvedAddress !== value && Boolean(resolvedAddress && isValidDomain(resolvedAddress));
};

// Check if a plain text pattern is a valid seedit community reference
export const isValidCommunityPattern = (pattern: string): boolean => {
  // Must start with "s/"
  if (!pattern.startsWith('s/')) {
    return false;
  }

  const pathPart = pattern.substring(2); // Remove "s/"

  // Check if it's a post pattern: communityAddress/comments/cid
  const postMatch = pathPart.match(/^([^/]+)\/comments\/([^/]+)$/);
  if (postMatch) {
    const [, communityAddress, cid] = postMatch;
    // CID should be at least 10 characters (minimum reasonable CID length)
    return isValidCommunityReference(communityAddress) && cid.length >= 10;
  }

  // Check if it's just a community pattern: communityAddress
  return isValidCommunityReference(pathPart);
};

// Preprocess content to convert plain text seedit patterns to markdown links
export const preprocessSeeditPatterns = (content: string, knownDirectoryCodes?: KnownDirectoryCodes): string => {
  // Pattern to match "s/something" or "s/something/comments/something"
  const pattern = /\bs\/([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*(?:\/comments\/[a-zA-Z0-9]{10,100})?)([.,:;!?]*)/g;

  return content.replace(pattern, (match, capturedPath, trailingPunctuation, offset, source) => {
    const precedingToken = source.slice(
      Math.max(source.lastIndexOf(' ', offset - 1), source.lastIndexOf('\n', offset - 1), source.lastIndexOf('\t', offset - 1)) + 1,
      offset,
    );
    if (/(?:[a-z][a-z0-9+.-]*:\/\/|www\.)\S*$/i.test(precedingToken)) return match;

    const fullPattern = `s/${capturedPath}`;

    if (isValidCommunityPattern(fullPattern)) {
      const postMatch = capturedPath.match(/^([^/]+)\/comments\/([^/]+)$/);
      const internalPath = postMatch
        ? getCommunityReferencePostPath(postMatch[1], postMatch[2], knownDirectoryCodes)
        : getCommunityReferencePath(capturedPath, knownDirectoryCodes);
      // Convert to markdown link format and preserve trailing punctuation
      return `[${fullPattern}](${internalPath})${trailingPunctuation}`;
    }

    // If not valid, return unchanged
    return match;
  });
};
