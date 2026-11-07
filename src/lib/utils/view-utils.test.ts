import { describe, expect, it } from 'vitest';
import { getAboutLink, getPendingPostKey, getPendingPostRedirect, isCommunitiesDirectoryAboutView, isCommunitiesDirectoryView, isPendingPostPath } from './view-utils';

describe('isCommunitiesDirectoryView', () => {
  it('matches the directory index and individual directories only', () => {
    expect(isCommunitiesDirectoryView('/communities/directories')).toBe(true);
    expect(isCommunitiesDirectoryView('/communities/directories/askseedit')).toBe(true);
    expect(isCommunitiesDirectoryView('/communities/directories/askseedit/about')).toBe(true);
    expect(isCommunitiesDirectoryView('/communities/directories-extra')).toBe(false);
    expect(isCommunitiesDirectoryView('/communities/vote')).toBe(false);
  });
});

describe('directory about views', () => {
  it('recognizes only directory about routes', () => {
    expect(isCommunitiesDirectoryAboutView('/communities/directories/about')).toBe(true);
    expect(isCommunitiesDirectoryAboutView('/communities/directories/askseedit/about')).toBe(true);
    expect(isCommunitiesDirectoryAboutView('/communities/directories/askseedit')).toBe(false);
  });

  it('links the directory index and candidate list to their own mobile sidebar views', () => {
    expect(getAboutLink('/communities/directories', {})).toBe('/communities/directories/about');
    expect(getAboutLink('/communities/directories/askseedit', { directoryCode: 'askseedit' })).toBe('/communities/directories/askseedit/about');
  });
});

describe('getPendingPostRedirect', () => {
  const postA = getPendingPostKey({ timestamp: 1000, communityAddress: 'example.bso' });
  const postB = getPendingPostKey({ timestamp: 2000, communityAddress: 'example.bso' });

  it('identifies a pending post only once it has a timestamp', () => {
    expect(getPendingPostKey(undefined)).toBeUndefined();
    expect(getPendingPostKey({})).toBeUndefined();
    expect(postA).toBe('example.bso:1000');
  });

  it('keeps rendering a valid pending post and a regular post route', () => {
    expect(getPendingPostRedirect({}, { accountCommentIndex: '1', key: postA }, true)).toBeUndefined();
    expect(getPendingPostRedirect({ accountCommentIndex: '1', key: postA }, { accountCommentIndex: '1', key: postA }, true)).toBeUndefined();
    expect(getPendingPostRedirect({}, {}, true)).toBeUndefined();
  });

  it('goes back when the rendered pending post is deleted and the index becomes invalid', () => {
    expect(getPendingPostRedirect({ accountCommentIndex: '1', key: postA }, { accountCommentIndex: '1', key: undefined }, false)).toBe('back');
  });

  it('goes back when a later account comment shifts into the rendered index', () => {
    expect(getPendingPostRedirect({ accountCommentIndex: '0', key: postA }, { accountCommentIndex: '0', key: postB }, true)).toBe('back');
  });

  it('shows not found for an invalid index that was never rendered', () => {
    expect(getPendingPostRedirect({}, { accountCommentIndex: '99', key: undefined }, false)).toBe('not-found');
    expect(getPendingPostRedirect({ accountCommentIndex: '1', key: postA }, { accountCommentIndex: '99', key: undefined }, false)).toBe('not-found');
  });

  it('does not treat a rendered index without a comment key as rendered', () => {
    expect(getPendingPostRedirect({ accountCommentIndex: '1', key: undefined }, { accountCommentIndex: '1', key: postA }, true)).toBeUndefined();
    expect(getPendingPostRedirect({ accountCommentIndex: '1', key: undefined }, { accountCommentIndex: '1', key: undefined }, false)).toBe('not-found');
  });
});

describe('isPendingPostPath', () => {
  it('matches an account comment pending page and none of the other profile pages', () => {
    for (const pathname of ['/profile/0', '/profile/12', '/profile/12/', '/profile/not-an-index']) expect(isPendingPostPath(pathname)).toBe(true);
    for (const pathname of [
      '/profile',
      '/profile/about',
      '/profile/upvoted',
      '/profile/downvoted',
      '/profile/hidden',
      '/profile/saved',
      '/profile/comments',
      '/profile/submitted',
      '/profile/12/about',
      '/u/profile/12',
    ]) {
      expect(isPendingPostPath(pathname)).toBe(false);
    }
  });

  it('ignores case, as the router does', () => {
    expect(isPendingPostPath('/PROFILE/7')).toBe(true);
    expect(isPendingPostPath('/Profile/ABOUT')).toBe(false);
  });
});
