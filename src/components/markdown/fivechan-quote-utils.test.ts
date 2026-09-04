import { describe, expect, it } from 'vitest';
import { getFivechanQuoteReferences, preprocessFivechanQuoteLines } from './fivechan-quote-utils';

describe('getFivechanQuoteReferences', () => {
  it('collects same-board and cross-board quotes outside fenced code', () => {
    expect(getFivechanQuoteReferences('>>88\n>>>/fit/77 text\n```\n>>1\n```\n>>88')).toEqual([
      { number: 88, raw: '>>88' },
      { board: 'fit', number: 77, raw: '>>>/fit/77' },
      { number: 88, raw: '>>88' },
    ]);
  });
});

describe('preprocessFivechanQuoteLines', () => {
  it('links quotes when no parent number is known', () => {
    expect(preprocessFivechanQuoteLines('>>88\nclassic tactic')).toBe('[5chan quote](/__seedit-fivechan-quote/88)\nclassic tactic');
  });

  it('strips quotes that all point at the parent, keeping any text after the quote', () => {
    expect(preprocessFivechanQuoteLines('>>88\nclassic tactic', 88)).toBe('classic tactic');
    expect(preprocessFivechanQuoteLines('>>88 classic tactic\n>>88', 88)).toBe('classic tactic');
  });

  it('keeps every quote when any of them points somewhere other than the parent', () => {
    expect(preprocessFivechanQuoteLines('>>88\n>>42\nboth', 88)).toBe('[5chan quote](/__seedit-fivechan-quote/88)\n[5chan quote](/__seedit-fivechan-quote/42)\nboth');
    expect(preprocessFivechanQuoteLines('>>>/biz/88\nother board', 88)).toBe('[5chan quote](/__seedit-fivechan-quote/biz/88)\nother board');
  });

  it('leaves fenced code untouched even when it quotes the parent', () => {
    expect(preprocessFivechanQuoteLines('```\n>>88\n```', 88)).toBe('```\n>>88\n```');
  });
});
