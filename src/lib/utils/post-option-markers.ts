// 5chan fortune and dice marker parsing, ported from 5chan's `src/lib/utils/post-option-markers.ts`. The CID
// hashing that turns a marker into a result is in post-option-results.ts, which only the lazily loaded markdown
// chunk imports, so stripping markers from titles costs no sha256 at startup. Keep the patterns and the
// cutoff in sync with 5chan, or the two clients read the same post differently.

export const FORTUNE_DIRECTORY_CODES = new Set(['b', 's5s']);
export const DICE_DIRECTORY_CODES = new Set(['qst', 'tg']);
const MAX_DICE_COUNT = 25;

export const isFortuneDirectoryCode = (directoryCode: string | undefined): boolean => !!directoryCode && FORTUNE_DIRECTORY_CODES.has(directoryCode);

export const isDiceDirectoryCode = (directoryCode: string | undefined): boolean => !!directoryCode && DICE_DIRECTORY_CODES.has(directoryCode);

export interface FortuneEntry {
  color: string;
  text: string;
}

export const FORTUNE_ENTRIES: readonly FortuneEntry[] = [
  { text: 'Bad Luck', color: '#7fec11' },
  { text: 'Average Luck', color: '#bac200' },
  { text: 'Good Luck', color: '#e7890c' },
  { text: 'Excellent Luck', color: '#fd4d32' },
  { text: 'Reply hazy, try again', color: '#f51c6a' },
  { text: 'Godly Luck', color: '#d302a7' },
  { text: 'Very Bad Luck', color: '#9d05da' },
  { text: 'Outlook good', color: '#6023f8' },
  { text: 'Better not tell you now', color: '#2a56fb' },
  { text: 'You will meet a dark handsome stranger', color: '#0893e1' },
  { text: 'ｷﾀ━━━━━━(ﾟ∀ﾟ)━━━━━━ !!!!', color: '#00cbb0' },
  { text: '（　´_ゝ`）ﾌｰﾝ ', color: '#16f174' },
  { text: 'Good news will come to you by mail', color: '#43fd3b' },
];

export interface DiceSpec {
  count: number;
  sides: number;
  modifier: number;
  modifierText: string;
}

const getDiceSpec = (rawCount: string, rawSides: string, sign: string | undefined, rawModifier: string | undefined): DiceSpec | null => {
  const count = Number(rawCount);
  const sides = Number(rawSides);
  const modifierValue = rawModifier ? Number(rawModifier) : 0;
  // Safe integers keep the `[dice=…]` marker exact; a larger number would print as 1e+21.
  if (!Number.isSafeInteger(count) || !Number.isSafeInteger(sides) || !Number.isSafeInteger(modifierValue) || count < 1 || sides < 1) {
    return null;
  }

  const cappedCount = Math.min(MAX_DICE_COUNT, count);
  // The highest total must stay a safe integer too, or the shown total would not equal the shown rolls.
  if (sides > (Number.MAX_SAFE_INTEGER - modifierValue) / cappedCount) {
    return null;
  }

  return {
    count: cappedCount,
    sides,
    modifier: sign === '-' ? -modifierValue : modifierValue,
    modifierText: sign ? ` ${sign} ${modifierValue}` : '',
  };
};

const DICE_MARKER_PATTERN = '\\[dice=(\\d+)d(\\d+)(?:([+-])(\\d+))?\\]';

// Before the CID derivation, the poster's 5chan client rolled the result and stored it in the post. Posts from
// before this time keep showing that stored result, and only that: a typed `[fortune]` or `[dice=1d6]` was
// plain text then. 2026-11-05T17:50:00Z, 5chan's release of the CID derivation.
const STORED_POST_OPTION_RESULTS_BEFORE_TIMESTAMP = 1793901000;

export const usesStoredResults = (timestamp: number | undefined): boolean => typeof timestamp === 'number' && timestamp < STORED_POST_OPTION_RESULTS_BEFORE_TIMESTAMP;
// 5chan matches the legacy BBCode as `\[fortune color=(#…)\]([^\r\n]*?)\[\/fortune\]`. Seedit matches only its opener
// with the regex and finds the closer in findFortuneMarkers, with the same result: the regex would rescan the rest
// of the line for every unclosed opener, so a post of many openers would freeze each reader for seconds.
const LEGACY_FORTUNE_BBCODE_OPENER_PATTERN = '\\[fortune color=(#[0-9a-fA-F]{6})\\]';
const LEGACY_FORTUNE_BBCODE_CLOSER = '[/fortune]';
const LEGACY_FORTUNE_HTML_PATTERN = '<span class="fortune" style="color:(#[0-9a-fA-F]{6})"><br><br><b>Your fortune: ([^<]+)<\\/b><\\/span>';
const LEGACY_DICE_PATTERN = '<b>(Rolled \\d+(?:, \\d+)*(?: [+-] \\d+)?(?: = -?\\d+)? \\((\\d+)d(\\d+)(?: ([+-]) (\\d+))?\\))<br><br><\\/b>';
const FORTUNE_MARKERS_PATTERN = `\\[fortune\\]|${LEGACY_FORTUNE_BBCODE_OPENER_PATTERN}|${LEGACY_FORTUNE_HTML_PATTERN}`;
const DICE_MARKERS_PATTERN = `${DICE_MARKER_PATTERN}|${LEGACY_DICE_PATTERN}`;

const getMatchingFortuneEntry = (color: string, text: string): FortuneEntry | undefined =>
  FORTUNE_ENTRIES.find((entry) => entry.color.toLowerCase() === color.toLowerCase() && entry.text === text);

interface FortuneMarker {
  index: number;
  length: number;
  storedFortune?: FortuneEntry;
}

interface DiceMarker {
  index: number;
  length: number;
  spec: DiceSpec | null;
  storedText?: string;
}

// Legacy fortune markup only counts when it names a real fortune, as old clients generated it, but a match that
// names none still hides the text it spans from the other markers, as in 5chan.
const findFortuneMarkers = (content: string): FortuneMarker[] => {
  const markers: FortuneMarker[] = [];
  const pattern = new RegExp(FORTUNE_MARKERS_PATTERN, 'g');
  const lineBreakPattern = /[\r\n]/g;
  // The first closer and line break at or after the last opener's end; openers come in order, so each only moves forward.
  let closerIndex: number | undefined;
  let lineBreakIndex: number | undefined;
  for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
    let length = match[0].length;
    let color = match[2];
    let text = match[3];
    if (match[1] !== undefined) {
      const bodyStart = match.index + length;
      if (closerIndex === undefined || (closerIndex !== -1 && closerIndex < bodyStart)) {
        closerIndex = content.indexOf(LEGACY_FORTUNE_BBCODE_CLOSER, bodyStart);
      }
      if (lineBreakIndex === undefined || (lineBreakIndex !== -1 && lineBreakIndex < bodyStart)) {
        lineBreakPattern.lastIndex = bodyStart;
        lineBreakIndex = lineBreakPattern.exec(content)?.index ?? -1;
      }
      // An opener without a closer on its line matches nothing. No other marker can start inside the opener, so the
      // search goes on after it.
      if (closerIndex === -1 || (lineBreakIndex !== -1 && lineBreakIndex < closerIndex)) continue;
      length = closerIndex + LEGACY_FORTUNE_BBCODE_CLOSER.length - match.index;
      color = match[1];
      text = content.slice(bodyStart, closerIndex);
      pattern.lastIndex = match.index + length;
    }
    if (!color) {
      markers.push({ index: match.index, length });
      continue;
    }
    const storedFortune = getMatchingFortuneEntry(color, text);
    if (storedFortune) markers.push({ index: match.index, length, storedFortune });
  }
  return markers;
};

const findDiceMarkers = (content: string): DiceMarker[] =>
  [...content.matchAll(new RegExp(DICE_MARKERS_PATTERN, 'g'))].map((match) =>
    match[1] !== undefined
      ? { index: match.index, length: match[0].length, spec: getDiceSpec(match[1], match[2], match[3], match[4]) }
      : { index: match.index, length: match[0].length, spec: getDiceSpec(match[6], match[7], match[8], match[9]), storedText: match[5] },
  );

const removeMarkers = (content: string, markers: Array<{ index: number; length: number }>): string => {
  let result = '';
  let lastIndex = 0;
  for (const marker of markers.toSorted((a, b) => a.index - b.index)) {
    if (marker.index < lastIndex) continue;
    result += content.slice(lastIndex, marker.index);
    lastIndex = marker.index + marker.length;
  }
  return result + content.slice(lastIndex);
};

interface MarkerTypes {
  dice: boolean;
  fortune: boolean;
  /** Only legacy markup holding a stored result counts, as for a post from before the cutoff. */
  storedOnly: boolean;
}

export const getMarkerTypes = (directoryCode: string | undefined, timestamp: number | undefined): MarkerTypes => ({
  dice: isDiceDirectoryCode(directoryCode),
  fortune: isFortuneDirectoryCode(directoryCode),
  storedOnly: usesStoredResults(timestamp),
});

export const findMarkers = (content: string, { dice, fortune, storedOnly }: MarkerTypes) => ({
  diceMarkers: dice ? findDiceMarkers(content).filter((marker) => !storedOnly || marker.storedText !== undefined) : [],
  fortuneMarkers: fortune ? findFortuneMarkers(content).filter((marker) => !storedOnly || marker.storedFortune) : [],
});

const stripMarkers = (content: string, markerTypes: MarkerTypes): string => {
  const { diceMarkers, fortuneMarkers } = findMarkers(content, markerTypes);
  return removeMarkers(content, [...diceMarkers, ...fortuneMarkers]);
};

// Removing `[fortune]` from `[fort[fortune]une]` leaves a new marker, so strip until nothing changes. Each pass
// rescans the whole post, so a post nested thousands deep would freeze each reader; past this many passes its
// leftover markers stay as text. No real post nests that deep, and results come from the first scan only.
const MAX_STRIP_PASSES = 16;

export const stripMarkersUntilStable = (content: string, markerTypes: MarkerTypes): string => {
  let result = content;
  for (let pass = 0; pass < MAX_STRIP_PASSES; pass += 1) {
    const stripped = stripMarkers(result, markerTypes);
    if (stripped === result) break;
    result = stripped;
  }
  return result;
};

/**
 * Hides the fortune and dice markers the post's board reads, for text that shows no result, such as a feed
 * title. Other boards publish and show the same text as typed, so it stays.
 */
export const stripPostOptionMarkers = (content: string, { directoryCode, timestamp }: { directoryCode: string | undefined; timestamp?: number }): string => {
  const markerTypes = getMarkerTypes(directoryCode, timestamp);
  return markerTypes.dice || markerTypes.fortune ? stripMarkersUntilStable(content, markerTypes) : content;
};
