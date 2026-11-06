import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FORTUNE_ENTRIES, findMarkers, stripPostOptionMarkers } from './post-option-markers';
import { getPostOptionResults } from './post-option-results';

const CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
const AFTER_CUTOFF = 1_800_000_000;
const BEFORE_CUTOFF = 1_793_496_024;

// The digest of the input as a big-endian unsigned integer, as 5chan's derivation reads it.
const digestValue = (input: string) => BigInt(`0x${createHash('sha256').update(input).digest('hex')}`);

describe('5chan fortune and dice results', () => {
  it("derives the fortune and dice 5chan's getPostOptionResults derives for a known CID", () => {
    // Expected values from 5chan's getPostOptionResults (bitsocialnet/5chan#1280).
    expect(getPostOptionResults({ content: 'body[fortune]', cid: CID, timestamp: AFTER_CUTOFF, directoryCode: 'b', isEdited: false })).toEqual({
      content: 'body',
      fortune: { text: 'ｷﾀ━━━━━━(ﾟ∀ﾟ)━━━━━━ !!!!', color: '#00cbb0' },
    });
    expect(getPostOptionResults({ content: '[dice=3d20+2]body', cid: CID, timestamp: AFTER_CUTOFF, directoryCode: 'tg', isEdited: false })).toEqual({
      content: 'body',
      diceText: 'Rolled 18, 15, 19 + 2 = 54 (3d20 + 2)',
    });
    expect(getPostOptionResults({ content: '[dice=1d6]body', cid: CID, timestamp: AFTER_CUTOFF, directoryCode: 'qst', isEdited: false }).diceText).toBe('Rolled 2 (1d6)');
    expect(getPostOptionResults({ content: '[dice=2d6-1]body', cid: CID, timestamp: AFTER_CUTOFF, directoryCode: 'tg', isEdited: false }).diceText).toBe(
      'Rolled 2, 1 - 1 = 2 (2d6 - 1)',
    );

    // The same values from the published formula: entry sha256("fortune:" + cid) mod 13, roll sha256("dice:" + cid + ":" + i) mod sides + 1.
    expect(FORTUNE_ENTRIES[Number(digestValue(`fortune:${CID}`) % BigInt(13))].text).toBe('ｷﾀ━━━━━━(ﾟ∀ﾟ)━━━━━━ !!!!');
    expect([0, 1, 2].map((index) => Number(digestValue(`dice:${CID}:${index}`) % BigInt(20)) + 1)).toEqual([18, 15, 19]);
  });

  it('reads only the markers of the post board, and leaves them as text on other boards', () => {
    const content = '[dice=1d6]body[fortune]';
    expect(getPostOptionResults({ content, cid: CID, timestamp: AFTER_CUTOFF, directoryCode: 'b', isEdited: false })).toEqual({
      content: '[dice=1d6]body',
      fortune: { text: 'ｷﾀ━━━━━━(ﾟ∀ﾟ)━━━━━━ !!!!', color: '#00cbb0' },
    });
    expect(getPostOptionResults({ content, cid: CID, timestamp: AFTER_CUTOFF, directoryCode: 'tg', isEdited: false })).toEqual({
      content: 'body[fortune]',
      diceText: 'Rolled 2 (1d6)',
    });
    for (const directoryCode of ['mu', undefined]) {
      expect(getPostOptionResults({ content, cid: CID, timestamp: AFTER_CUTOFF, directoryCode, isEdited: false })).toEqual({ content });
      expect(stripPostOptionMarkers(content, { directoryCode, timestamp: AFTER_CUTOFF })).toBe(content);
    }
  });

  it('hides the markers but shows no result while the post has no CID or after an edit changed its text', () => {
    expect(getPostOptionResults({ content: '[dice=1d6]body[fortune]', timestamp: AFTER_CUTOFF, directoryCode: 'b', isEdited: false })).toEqual({
      content: '[dice=1d6]body',
    });
    expect(getPostOptionResults({ content: '[dice=1d6]body', cid: CID, timestamp: AFTER_CUTOFF, directoryCode: 'tg', isEdited: true })).toEqual({ content: 'body' });
  });

  it('strips markers until none is left, so a nested marker cannot survive', () => {
    expect(getPostOptionResults({ content: '[fort[fortune]une]hi', cid: CID, timestamp: AFTER_CUTOFF, directoryCode: 'b', isEdited: false }).content).toBe('hi');
    expect(stripPostOptionMarkers('[fort[fortune]une]hi', { directoryCode: 's5s', timestamp: AFTER_CUTOFF })).toBe('hi');
  });

  it("finds the fortune markers 5chan's regex finds", () => {
    // 5chan's scan, whose lazy BBCode body rescans the rest of the line for every unclosed opener.
    const fivechanPattern =
      '\\[fortune\\]|\\[fortune color=(#[0-9a-fA-F]{6})\\]([^\\r\\n]*?)\\[\\/fortune\\]|<span class="fortune" style="color:(#[0-9a-fA-F]{6})"><br><br><b>Your fortune: ([^<]+)<\\/b><\\/span>';
    const findAs5chan = (content: string) =>
      [...content.matchAll(new RegExp(fivechanPattern, 'g'))].flatMap((match) => {
        const color = match[1] ?? match[3];
        const text = match[2] ?? match[4];
        if (!color) return [{ index: match.index, length: match[0].length }];
        const storedFortune = FORTUNE_ENTRIES.find((entry) => entry.color.toLowerCase() === color.toLowerCase() && entry.text === text);
        return storedFortune ? [{ index: match.index, length: match[0].length, storedFortune }] : [];
      });
    const [entry, otherEntry] = FORTUNE_ENTRIES;
    const fragments = [
      '[fortune]',
      `[fortune color=${entry.color}]`,
      `[fortune color=${otherEntry.color.toUpperCase()}]`,
      '[/fortune]',
      entry.text,
      otherEntry.text,
      `<span class="fortune" style="color:${entry.color}"><br><br><b>Your fortune: `,
      '</b></span>',
      '[fort',
      'une]',
      '\n',
      '\r',
      ' x',
      '<',
    ];
    // A fixed seed, so a failure names the same posts on every run.
    let seed = 866;
    const random = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    for (let post = 0; post < 2000; post += 1) {
      const content = Array.from({ length: 1 + Math.floor(random() * 12) }, () => fragments[Math.floor(random() * fragments.length)]).join('');
      expect(findMarkers(content, { dice: false, fortune: true, storedOnly: false }).fortuneMarkers, content).toEqual(findAs5chan(content));
    }
  });

  it('strips a hostile post of nested markers and unclosed legacy openers without freezing the reader', () => {
    // About 40 KB; the full regex rescan took over 6 s on a fast desktop.
    const hostile = `${'[fort'.repeat(400)}[fortune]${'une]'.repeat(400)}${'[fortune color=#000000]'.repeat(1300)}`;
    const start = performance.now();
    stripPostOptionMarkers(hostile, { directoryCode: 'b', timestamp: AFTER_CUTOFF });
    getPostOptionResults({ content: hostile, cid: CID, timestamp: AFTER_CUTOFF, directoryCode: 'b', isEdited: false });
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('shows the stored result of a post from before the CID derivation, and keeps its typed markers as text', () => {
    const legacyFortune = 'body[fortune color=#d302a7]Godly Luck[/fortune]';
    expect(getPostOptionResults({ content: legacyFortune, cid: CID, timestamp: BEFORE_CUTOFF, directoryCode: 'b', isEdited: false })).toEqual({
      content: 'body',
      fortune: { text: 'Godly Luck', color: '#d302a7' },
    });
    const legacyDice = '<b>Rolled 3, 4 = 7 (2d6)<br><br></b>body';
    expect(getPostOptionResults({ content: legacyDice, cid: CID, timestamp: BEFORE_CUTOFF, directoryCode: 'tg', isEdited: false })).toEqual({
      content: 'body',
      diceText: 'Rolled 3, 4 = 7 (2d6)',
    });

    const typed = '[dice=1d6]body[fortune]';
    expect(getPostOptionResults({ content: typed, cid: CID, timestamp: BEFORE_CUTOFF, directoryCode: 'b', isEdited: false })).toEqual({ content: typed });
    expect(getPostOptionResults({ content: typed, cid: CID, timestamp: BEFORE_CUTOFF, directoryCode: 'tg', isEdited: false })).toEqual({ content: typed });
    // Legacy markup after the cutoff is not a stored result anyone can trust, so the CID decides.
    expect(getPostOptionResults({ content: legacyFortune, cid: CID, timestamp: AFTER_CUTOFF, directoryCode: 'b', isEdited: false }).fortune?.text).toBe(
      'ｷﾀ━━━━━━(ﾟ∀ﾟ)━━━━━━ !!!!',
    );
  });
});
