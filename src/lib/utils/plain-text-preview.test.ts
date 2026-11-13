import { describe, expect, it } from 'vitest';
import { getPlainTextPreview } from './plain-text-preview';

describe('getPlainTextPreview', () => {
  it('keeps the readable text of common markdown', () => {
    expect(getPlainTextPreview('# Title\n\nSome **bold** and _italic_ with a [link](https://example.com).\n\n> quoted\n- item')).toBe(
      'Title Some bold and italic with a link. quoted item',
    );
  });

  it('drops images, code blocks and html', () => {
    expect(getPlainTextPreview('before ![alt](a.png) <b>x</b>\n```\ncode\n```\nafter')).toBe('before x after');
  });

  it('truncates long text', () => {
    expect(getPlainTextPreview('word '.repeat(20), 10)).toBe('word word…');
  });

  it('stays fast on long content full of unclosed markers', () => {
    const content = '*a ['.repeat(250_000);
    const start = performance.now();
    expect(getPlainTextPreview(content).length).toBeLessThanOrEqual(401);
    expect(performance.now() - start).toBeLessThan(100);
  });

  it('returns an empty string without content', () => {
    expect(getPlainTextPreview(undefined)).toBe('');
  });
});
