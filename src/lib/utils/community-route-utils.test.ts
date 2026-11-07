import { describe, expect, it } from 'vitest';
import {
  DIRECTORY_INDEX_PATH,
  getCanonicalCommunityPostRedirectPath,
  getCanonicalCommunityPostAboutRedirectPath,
  getCanonicalCommunityRoutePathname,
  getCommunityPath,
  getCommunityPostPath,
  getCommunityPostUrl,
  getCommunityReferencePath,
  getCommunityReferencePostPath,
  getCommunityRouteSegment,
  getDirectoryPath,
  getDirectoryAboutPath,
  getDirectoryCandidatesPath,
  getExactCommunityActionRedirectPath,
  resolveCommunityRouteAddress,
} from './community-route-utils';
import { VENDORED_DIRECTORY_CODES } from './directory-codes';

const PUBLIC_KEY = '12D3KooWFnLrUYHpvqki7gbL4w9JzdxjpQPKE2JBDEd23Ly6X82X';

describe('resolveCommunityRouteAddress', () => {
  it('expands bare community names with the default .bso TLD', () => {
    expect(resolveCommunityRouteAddress('aww')).toBe('aww.bso');
    expect(resolveCommunityRouteAddress('aww-posting')).toBe('aww-posting.bso');
  });

  it('leaves dotted names and public keys unchanged', () => {
    expect(resolveCommunityRouteAddress('aww.bso')).toBe('aww.bso');
    expect(resolveCommunityRouteAddress('business.eth')).toBe('business.eth');
    expect(resolveCommunityRouteAddress('topic.community.bso')).toBe('topic.community.bso');
    expect(resolveCommunityRouteAddress(PUBLIC_KEY)).toBe(PUBLIC_KEY);
  });

  it('leaves reserved route segments unchanged regardless of case', () => {
    expect(resolveCommunityRouteAddress('all')).toBe('all');
    expect(resolveCommunityRouteAddress('ALL')).toBe('ALL');
    expect(resolveCommunityRouteAddress('mod')).toBe('mod');
    expect(resolveCommunityRouteAddress('MoD')).toBe('MoD');
  });

  it('leaves empty and missing route segments unchanged', () => {
    expect(resolveCommunityRouteAddress('')).toBe('');
    expect(resolveCommunityRouteAddress(undefined)).toBeUndefined();
  });
});

describe('getCommunityRouteSegment', () => {
  it('uses explicit .bso addresses for bare and canonical names', () => {
    expect(getCommunityRouteSegment('aww')).toBe('aww.bso');
    expect(getCommunityRouteSegment('aww.bso')).toBe('aww.bso');
    expect(getCommunityRouteSegment('aww-posting.bso')).toBe('aww-posting.bso');
  });

  it('leaves other dotted names, reserved routes and public keys unchanged', () => {
    expect(getCommunityRouteSegment('business.eth')).toBe('business.eth');
    expect(getCommunityRouteSegment('topic.community.bso')).toBe('topic.community.bso');
    expect(getCommunityRouteSegment('all')).toBe('all');
    expect(getCommunityRouteSegment('mod')).toBe('mod');
    expect(getCommunityRouteSegment(PUBLIC_KEY)).toBe(PUBLIC_KEY);
  });
});

describe('community route builders', () => {
  it('builds canonical paths with explicit .bso addresses', () => {
    expect(getCommunityPath('aww')).toBe('/s/aww.bso');
    expect(getCommunityPath('aww.bso')).toBe('/s/aww.bso');
    expect(getCommunityPostPath('aww.bso', 'bafy-post-cid')).toBe('/s/aww.bso/comments/bafy-post-cid');
  });

  it('keeps explicit addresses when shorthand would be ambiguous', () => {
    expect(getCommunityPath('all.bso')).toBe('/s/all.bso');
    expect(getCommunityPath('topic.community.bso')).toBe('/s/topic.community.bso');
    expect(getCommunityPostPath(PUBLIC_KEY, 'bafy-post-cid')).toBe(`/s/${PUBLIC_KEY}/comments/bafy-post-cid`);
  });

  it('builds the exact s.seedit.app external post URL', () => {
    expect(getCommunityPostUrl('aww.bso', 'bafy-post-cid')).toBe('https://s.seedit.app/s/aww.bso/comments/bafy-post-cid');
  });

  it('keeps explicit directory paths separate from exact community paths', () => {
    expect(getDirectoryPath('funny')).toBe('/s/funny');
    expect(getCommunityPath('funny')).toBe('/s/funny.bso');
    expect(getCommunityReferencePath('funny')).toBe('/s/funny');
    expect(getCommunityReferencePath('funny.bso')).toBe('/s/funny.bso');
    expect(getCommunityReferencePath('unreserved-name')).toBe('/s/unreserved-name.bso');
    expect(getCommunityReferencePostPath('funny', 'bafy-post-cid')).toBe('/s/funny/comments/bafy-post-cid');
    expect(getCommunityReferencePostPath('funny.bso', 'bafy-post-cid')).toBe('/s/funny.bso/comments/bafy-post-cid');
  });

  it('builds the directory candidate list path without touching the community route', () => {
    expect(DIRECTORY_INDEX_PATH).toBe('/communities/directories');
    expect(getDirectoryCandidatesPath('memes')).toBe('/communities/directories/memes');
    expect(getDirectoryCandidatesPath('memes')).not.toBe(getDirectoryPath('memes'));
  });

  it('builds mobile about paths for the directory index and candidate lists', () => {
    expect(getDirectoryAboutPath()).toBe('/communities/directories/about');
    expect(getDirectoryAboutPath('memes')).toBe('/communities/directories/memes/about');
  });

  it('round-trips every canonical address', () => {
    for (const address of ['aww.bso', 'aww-posting.bso']) {
      expect(resolveCommunityRouteAddress(getCommunityRouteSegment(address))).toBe(address);
    }
  });

  it('canonicalizes mutable directory action routes to the exact winner', () => {
    expect(getExactCommunityActionRedirectPath('/s/funny/submit', 'funny', 'funny-posting.bso')).toBe('/s/funny-posting.bso/submit');
    expect(getExactCommunityActionRedirectPath('/s/funny/settings/editor', 'funny', 'funny-posting.bso', '?mode=raw', '#roles')).toBe(
      '/s/funny-posting.bso/settings/editor?mode=raw#roles',
    );
    expect(getExactCommunityActionRedirectPath('/s/news/submit', 'funny', 'funny-posting.bso')).toBeUndefined();
  });
});

describe('getCanonicalCommunityRoutePathname', () => {
  it('redirects bare community routes and preserves nested route suffixes', () => {
    expect(getCanonicalCommunityRoutePathname('/s/unreserved-name')).toBe('/s/unreserved-name.bso');
    expect(getCanonicalCommunityRoutePathname('/s/unreserved-name/comments/bafy-post-cid')).toBe('/s/unreserved-name.bso/comments/bafy-post-cid');
    expect(getCanonicalCommunityRoutePathname('/s/unreserved-name/settings')).toBe('/s/unreserved-name.bso/settings');
  });

  it('preserves known directory routes for route-only winner resolution', () => {
    expect(getCanonicalCommunityRoutePathname('/s/aww')).toBeUndefined();
    // a well-formed code may be a directory added after this build until the published directories load
    const unsettled = { codes: VENDORED_DIRECTORY_CODES, settled: false };
    expect(getCanonicalCommunityRoutePathname('/s/dogs/submit', unsettled)).toBeUndefined();
    expect(getCanonicalCommunityRoutePathname('/s/dogs/submit', { ...unsettled, settled: true })).toBe('/s/dogs.bso/submit');
    expect(getCanonicalCommunityRoutePathname('/s/dogs/submit', { codes: [...VENDORED_DIRECTORY_CODES, 'dogs'], settled: true })).toBeUndefined();
    expect(getCanonicalCommunityRoutePathname('/s/unreserved-name', unsettled)).toBe('/s/unreserved-name.bso');
    expect(getCanonicalCommunityRoutePathname('/s/aww/comments/bafy-post-cid')).toBeUndefined();
    expect(getCanonicalCommunityRoutePathname('/s/aww/settings')).toBeUndefined();
  });

  it('does not redirect canonical, reserved, public-key or unrelated routes', () => {
    expect(getCanonicalCommunityRoutePathname('/s/aww.bso')).toBeUndefined();
    expect(getCanonicalCommunityRoutePathname('/s/business.eth')).toBeUndefined();
    expect(getCanonicalCommunityRoutePathname('/s/all')).toBeUndefined();
    expect(getCanonicalCommunityRoutePathname('/s/mod')).toBeUndefined();
    expect(getCanonicalCommunityRoutePathname(`/s/${PUBLIC_KEY}`)).toBeUndefined();
    expect(getCanonicalCommunityRoutePathname('/settings')).toBeUndefined();
  });
});

describe('getCanonicalCommunityPostRedirectPath', () => {
  it('does not redirect when an unreserved bare route resolves to the post community', () => {
    expect(getCanonicalCommunityPostRedirectPath('unreserved-name', 'unreserved-name', 'bafy-post-cid')).toBeUndefined();
  });

  it('always redirects directory post routes to the post owner exact address', () => {
    expect(getCanonicalCommunityPostRedirectPath('aww', 'aww.bso', 'bafy-post-cid')).toBe('/s/aww.bso/comments/bafy-post-cid');
    expect(getCanonicalCommunityPostRedirectPath('funny', 'funny-posting.bso', 'bafy-post-cid')).toBe('/s/funny-posting.bso/comments/bafy-post-cid');
  });

  it('redirects a mismatched route to the canonical post community path', () => {
    expect(getCanonicalCommunityPostRedirectPath('wrong', 'aww.bso', 'bafy-post-cid')).toBe('/s/aww.bso/comments/bafy-post-cid');
  });
});

describe('getCanonicalCommunityPostAboutRedirectPath', () => {
  it('canonicalizes a directory-coded mobile about route to the post owner', () => {
    expect(getCanonicalCommunityPostAboutRedirectPath('funny', 'archived-funny.bso', 'bafy-post-cid')).toBe('/s/archived-funny.bso/comments/bafy-post-cid/about');
  });
});
