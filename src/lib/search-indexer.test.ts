import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSearchPageFromChain, getIndexedPostComment, type IndexedPost } from './search-indexer';
import type { SearchProvider } from './search-providers';

afterEach(() => {
  vi.unstubAllGlobals();
});

const provider: SearchProvider = { apiUrl: 'https://api.seeditarchive.org', id: 'seeditarchive', name: 'seeditarchive.org', siteUrl: 'https://seeditarchive.org' };
const backupProvider: SearchProvider = { apiUrl: 'https://backup.example', id: 'backup', name: 'backup.example', siteUrl: 'https://backup.example' };

const indexedPost = (overrides: Partial<IndexedPost> = {}): IndexedPost => ({
  archived: 0,
  author_address: '12D3KooWAbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcd',
  author_name: 'esteban',
  cid: 'QmPostCid',
  community_address: 'memes-posting.bso',
  content: 'post content',
  deleted: 0,
  depth: 0,
  downvote_count: 2,
  indexed_at: 1787000000,
  link: null,
  parent_cid: null,
  post_cid: 'QmPostCid',
  raw: null,
  removed: 0,
  reply_count: 3,
  thumbnail_url: null,
  timestamp: 1786000000,
  title: 'a title',
  upvote_count: 7,
  ...overrides,
});

const searchResponse = (posts: IndexedPost[], total = posts.length) => ({ query: 'test', page: 1, limit: 25, total, posts });

const okJson = (payload: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(payload) });

describe('fetchSearchPageFromChain', () => {
  it('requests the provider search endpoint with query, page and limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson(searchResponse([indexedPost()])));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSearchPageFromChain([provider], 'hello world', 2);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.seeditarchive.org/api/search?q=hello+world&page=2&limit=25&nsfw=false',
      expect.objectContaining({ headers: { Accept: 'application/json' }, signal: expect.any(AbortSignal) }),
    );
    expect(result.provider.id).toBe('seeditarchive');
    expect(result.total).toBe(1);
  });

  it('sends the community and nsfw choice the caller asked for', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson(searchResponse([indexedPost()])));
    vi.stubGlobal('fetch', fetchMock);

    await fetchSearchPageFromChain([provider], 'hello', 1, { community: 'aww-posting.bso', nsfw: true });

    expect(fetchMock).toHaveBeenCalledWith('https://api.seeditarchive.org/api/search?q=hello&page=1&limit=25&community=aww-posting.bso&nsfw=true', expect.anything());
  });

  it('sends the sort and time menus in the indexer vocabulary, and leaves the defaults out', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson(searchResponse([indexedPost()])));
    vi.stubGlobal('fetch', fetchMock);

    await fetchSearchPageFromChain([provider], 'hello', 1, { sort: 'comments', time: 'week' });
    await fetchSearchPageFromChain([provider], 'hello', 1, { sort: 'relevance', time: 'all' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api.seeditarchive.org/api/search?q=hello&page=1&limit=25&sort=replies&time=week&nsfw=false',
      'https://api.seeditarchive.org/api/search?q=hello&page=1&limit=25&nsfw=false',
    ]);
  });

  it('rejects a response that does not match the search contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ query: 'test', page: 1, limit: 25, total: 1, posts: [{ cid: 'only-a-cid' }] })));
    await expect(fetchSearchPageFromChain([provider], 'test', 1)).rejects.toThrow('Search provider returned an invalid response');
  });

  it('fails over to the next provider and reports who answered', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(okJson(searchResponse([indexedPost()])));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSearchPageFromChain([provider, backupProvider], 'test', 1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.provider.id).toBe('backup');
  });

  it('rethrows the last error when every provider fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchSearchPageFromChain([provider, backupProvider], 'test', 1)).rejects.toThrow('Search provider returned 500');
  });

  it('fetches the thread OP of each matched reply once and swallows a failed one', async () => {
    const replyA = indexedPost({ cid: 'QmReplyA', depth: 1, parent_cid: 'QmThread1', post_cid: 'QmThread1' });
    const replyB = indexedPost({ cid: 'QmReplyB', depth: 2, parent_cid: 'QmReplyA', post_cid: 'QmThread1' });
    const replyC = indexedPost({ cid: 'QmReplyC', depth: 1, parent_cid: 'QmThread2', post_cid: 'QmThread2' });
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/search')) return Promise.resolve(okJson(searchResponse([replyA, replyB, replyC], 3)));
      if (url.includes('/api/posts/QmThread1')) return Promise.resolve(okJson({ post: indexedPost({ cid: 'QmThread1', post_cid: 'QmThread1' }) }));
      return Promise.resolve({ ok: false, status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSearchPageFromChain([provider], 'test', 1);

    const postUrls = fetchMock.mock.calls.map(([url]) => url).filter((url: string) => url.includes('/api/posts/'));
    expect(postUrls).toEqual(['https://api.seeditarchive.org/api/posts/QmThread1', 'https://api.seeditarchive.org/api/posts/QmThread2']);
    expect(Object.keys(result.threadPosts)).toEqual(['QmThread1']);
  });
});

describe('getIndexedPostComment', () => {
  it('keeps the indexed columns authoritative over the raw payload', () => {
    const raw = JSON.stringify({
      comment: { title: 'stale title', content: 'stale content', author: { address: 'attacker.bso', displayName: 'stale name' }, subplebbitAddress: 'memes-posting.bso' },
      commentUpdate: { upvoteCount: 999, replies: { pages: {} }, pinned: true },
    });
    const comment = getIndexedPostComment(indexedPost({ raw, title: 'fresh title', content: 'fresh content' }));

    expect(comment.title).toBe('fresh title');
    expect(comment.content).toBe('fresh content');
    expect(comment.cid).toBe('QmPostCid');
    expect(comment.communityAddress).toBe('memes-posting.bso');
    expect(comment.upvoteCount).toBe(7);
    expect(comment.downvoteCount).toBe(2);
    expect(comment.replyCount).toBe(3);
    expect(comment.state).toBe('succeeded');
    // reply pages are large nested payloads the search view never renders
    expect(comment.replies).toBeUndefined();
    // pinning is feed-positional and gates community role badges, so an archived payload cannot claim it
    expect(comment.pinned).toBeUndefined();
  });

  it('keeps the author but derives the short address from the indexed column', () => {
    const comment = getIndexedPostComment(indexedPost());
    expect(comment.author?.address).toBe('12D3KooWAbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcd');
    expect(comment.author?.displayName).toBe('esteban');
    expect(comment.author?.shortAddress).toBe('AbCdEfGhIjKl');

    const namedAuthor = getIndexedPostComment(indexedPost({ author_address: 'esteban.bso' }));
    expect(namedAuthor.author?.shortAddress).toBe('esteban.bso');
  });

  it('maps flags and nullable fields for replies', () => {
    const comment = getIndexedPostComment(
      indexedPost({ archived: 1, deleted: 0, removed: 0, depth: 1, parent_cid: 'QmParent', post_cid: 'QmThread', cid: 'QmReply', title: null, content: 'a reply' }),
    );
    expect(comment.archived).toBe(true);
    expect(comment.deleted).toBe(false);
    expect(comment.removed).toBe(false);
    expect(comment.parentCid).toBe('QmParent');
    expect(comment.postCid).toBe('QmThread');
    expect(comment.title).toBeUndefined();
    expect(comment.content).toBe('a reply');
  });
});
