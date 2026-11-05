// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import type { Comment, Community, CommunityIdentifier } from '@bitsocial/bitsocial-react-hooks';
import { getFeedCommunityGroups, hasLoadingFeedCommunities, hasUnresolvedPostSortMetadata, mergeAndSortFeeds } from '../lib/utils/feed-sort-utils';

const identifier = (name: string): CommunityIdentifier => ({ name });
const community = ({ pages, pageCids = {} }: { pages: string[]; pageCids?: Record<string, string> }) =>
  ({
    posts: {
      pages: Object.fromEntries(pages.map((sortType) => [sortType, { comments: [] }])),
      pageCids,
    },
  }) as Community;

const post = (cid: string, timestamp: number, upvoteCount: number, downvoteCount = 0): Comment => ({ cid, timestamp, upvoteCount, downvoteCount }) as Comment;

describe('getFeedCommunityGroups', () => {
  it('uses requested protocol pages when the community publishes the sort', () => {
    const identifiers = [identifier('one.bso')];
    expect(getFeedCommunityGroups(identifiers, [community({ pages: ['hot'], pageCids: { topAll: 'cid' } })], 'topAll')).toEqual({
      requestedSortCommunities: identifiers,
      preloadedSortCommunities: [],
    });
  });

  it.each(['new', 'active', 'topAll'])('uses a complete single preloaded page as the source for the %s client sort', (sortType) => {
    const identifiers = [identifier('one.bso')];
    expect(getFeedCommunityGroups(identifiers, [community({ pages: ['hot'] })], sortType)).toEqual({
      requestedSortCommunities: [],
      preloadedSortCommunities: identifiers,
    });
  });

  it('does not substitute preloaded data for an unavailable custom sort', () => {
    const identifiers = [identifier('one.bso')];
    expect(getFeedCommunityGroups(identifiers, [community({ pages: ['hot'] })], 'custom')).toEqual({
      requestedSortCommunities: [],
      preloadedSortCommunities: [],
    });
  });

  it('does not substitute an incomplete preloaded page for an unavailable built-in sort', () => {
    const identifiers = [identifier('one.bso')];
    expect(getFeedCommunityGroups(identifiers, [community({ pages: ['hot'], pageCids: { hot: 'hot-cid' } })], 'topAll')).toEqual({
      requestedSortCommunities: [],
      preloadedSortCommunities: [],
    });
  });
});

describe('hasUnresolvedPostSortMetadata', () => {
  it('keeps a requested sort pending until the community publishes its post page map', () => {
    expect(hasUnresolvedPostSortMetadata([{} as Community], 'hot')).toBe(true);
    expect(hasUnresolvedPostSortMetadata([community({ pages: ['hot'] })], 'hot')).toBe(false);
  });

  it.each(['waiting-retry', 'failed', 'stopped', 'succeeded'])('does not let %s communities block available feed data', (updatingState) => {
    expect(hasUnresolvedPostSortMetadata([{ updatingState } as Community], 'hot')).toBe(false);
  });

  it.each(['resolving-name', 'fetching-ipns', 'fetching-ipfs'])('keeps metadata pending while a community is %s', (updatingState) => {
    expect(hasUnresolvedPostSortMetadata([{ updatingState } as Community], 'hot')).toBe(true);
  });

  it('does not let an unresolved community block peers with published sort metadata', () => {
    expect(hasUnresolvedPostSortMetadata([{ updatingState: 'fetching-ipns' } as Community, community({ pages: ['hot'] })], 'hot')).toBe(false);
  });

  it('does not keep an explicitly unavailable sort pending after page metadata is published', () => {
    expect(hasUnresolvedPostSortMetadata([community({ pages: ['hot'] })], 'custom')).toBe(false);
  });
});

describe('hasLoadingFeedCommunities', () => {
  it('keeps a feed loading while one of its communities has no entry', () => {
    expect(hasLoadingFeedCommunities([community({ pages: ['hot'] }), undefined])).toBe(true);
  });

  it('keeps a feed loading while a community without a record fetches beside a loaded one', () => {
    expect(hasLoadingFeedCommunities([community({ pages: ['hot'] }), { updatingState: 'fetching-ipns' } as Community])).toBe(true);
  });

  it.each(['waiting-retry', 'failed', 'stopped', 'succeeded'])('does not wait for a %s community without a record', (updatingState) => {
    expect(hasLoadingFeedCommunities([{ updatingState } as Community])).toBe(false);
  });

  it('does not wait for a community with a record and no posts while it updates again', () => {
    expect(hasLoadingFeedCommunities([{ updatedAt: 1, updatingState: 'fetching-ipns' } as Community])).toBe(false);
  });
});

describe('mergeAndSortFeeds', () => {
  it('deduplicates posts and applies the requested client sort to the combined feed', () => {
    const olderPopular = post('popular', 1, 10);
    const newer = post('newer', 2, 1);
    expect(mergeAndSortFeeds([newer], [olderPopular, newer], 'topAll').map(({ cid }) => cid)).toEqual(['popular', 'newer']);
  });
});
