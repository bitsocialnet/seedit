import { describe, expect, it } from 'vitest';
import { getThreadPermissions, sortThreadReplies } from './post-utils';

const NOW = 10_000;
const reply = (cid: string, fields: Record<string, unknown> = {}) => ({ cid, timestamp: 100, author: { address: 'writer.bso' }, ...fields });
const cids = (replies: { cid: string }[]) => replies.map((item) => item.cid);

describe('sortThreadReplies', () => {
  it('puts pinned replies first, newest first, under every sort', () => {
    const replies = [reply('a', { timestamp: 1 }), reply('pinned-old', { pinned: true, timestamp: 2 }), reply('pinned-new', { pinned: true, timestamp: 3 })];
    for (const sort of ['best', 'new', 'old'] as const) {
      expect(cids(sortThreadReplies(replies, sort, undefined, NOW)).slice(0, 2)).toEqual(['pinned-new', 'pinned-old']);
    }
  });

  it('orders by timestamp for new and old', () => {
    const replies = [reply('middle', { timestamp: 2 }), reply('oldest', { timestamp: 1 }), reply('newest', { timestamp: 3 })];
    expect(cids(sortThreadReplies(replies, 'new', undefined, NOW))).toEqual(['newest', 'middle', 'oldest']);
    expect(cids(sortThreadReplies(replies, 'old', undefined, NOW))).toEqual(['oldest', 'middle', 'newest']);
  });

  it("keeps the account's replies from the last 30 minutes at the top of best", () => {
    const replies = [
      reply('popular', { upvoteCount: 50, timestamp: 1 }),
      reply('mine-recent', { author: { address: 'me.bso' }, timestamp: NOW - 60 }),
      reply('mine-old', { author: { address: 'me.bso' }, timestamp: NOW - 31 * 60 }),
    ];
    expect(cids(sortThreadReplies(replies, 'best', 'me.bso', NOW))).toEqual(['mine-recent', 'popular', 'mine-old']);
  });

  it('drops deleted replies without children and keeps deleted replies with children', () => {
    const replies = [reply('deleted-leaf', { deleted: true, replyCount: 0 }), reply('deleted-parent', { deleted: true, replyCount: 2 })];
    expect(cids(sortThreadReplies(replies, 'new', undefined, NOW))).toEqual(['deleted-parent']);
  });

  it('does not reorder the array it was given', () => {
    const replies = [reply('b', { timestamp: 2 }), reply('a', { timestamp: 1 })];
    sortThreadReplies(replies, 'old', undefined, NOW);
    sortThreadReplies(replies, 'best', undefined, NOW);
    expect(cids(replies)).toEqual(['b', 'a']);
  });
});

describe('getThreadPermissions', () => {
  it('allows votes and replies on an open published post', () => {
    expect(getThreadPermissions({ cid: 'post' }, false)).toEqual({ canVote: true, canReply: true });
  });

  it('allows nothing before the post is published', () => {
    expect(getThreadPermissions({}, true)).toEqual({ canVote: false, canReply: false });
  });

  it('closes removed, deleted, and archived posts to everyone, moderators included', () => {
    for (const flag of ['removed', 'deleted', 'archived']) {
      expect(getThreadPermissions({ cid: 'post', [flag]: true }, true)).toEqual({ canVote: false, canReply: false });
    }
  });

  it('lets only moderators reply on a locked post, and nobody vote', () => {
    expect(getThreadPermissions({ cid: 'post', locked: true }, false)).toEqual({ canVote: false, canReply: false });
    expect(getThreadPermissions({ cid: 'post', locked: true }, true)).toEqual({ canVote: false, canReply: true });
  });
});
