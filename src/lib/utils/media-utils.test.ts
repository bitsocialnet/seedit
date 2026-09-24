import { describe, expect, it, vi } from 'vitest';
import { getLinkMediaInfo } from './media-utils';

// The thumbnail cache opens browser storage at import time.
vi.mock('@bitsocial/bitsocial-react-hooks/dist/lib/localforage-lru/index.js', () => ({
  default: { createInstance: () => ({ getItem: vi.fn(), setItem: vi.fn() }) },
}));

describe('getLinkMediaInfo', () => {
  it.each([
    ['https://example.com/photo.JPG', 'image'],
    ['https://example.com/a.b/photo.webp?size=large', 'image'],
    ['https://example.com/anim.gif', 'gif'],
    ['https://example.com/clip.mp4', 'video'],
    ['https://example.com/song.mp3', 'audio'],
    ['https://example.com/paper.pdf', 'pdf'],
    ['https://example.com/article.html', 'webpage'],
    ['https://example.com/gif', 'webpage'],
    ['https://example.com/archive.tar.gz', 'webpage'],
  ])('classifies %s as %s', (link, type) => {
    expect(getLinkMediaInfo(link)?.type).toBe(type);
  });
});
