import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { FORTUNE_ENTRIES, findMarkers, getMarkerTypes, stripMarkersUntilStable, type DiceSpec, type FortuneEntry } from './post-option-markers';

// The reader half of 5chan's getPostOptionResults (`src/lib/utils/post-options-utils.ts`). Only the markdown
// chunk imports this file, so sha256 loads with it rather than at startup.

interface DiceRoll extends DiceSpec {
  rolls: number[];
  total: number;
}

/*
 * A 5chan post never stores a fortune or dice result. The composer publishes an opt-in marker, `[fortune]` or
 * `[dice=2d6+1]`, and every reader derives the result from the post's CID, so no text in a post can forge one:
 *   fortune = FORTUNE_ENTRIES[sha256("fortune:" + cid) mod 13]
 *   dice roll i (from 0) = sha256("dice:" + cid + ":" + i) mod sides + 1
 * reading each digest as a big-endian unsigned integer.
 */
const getCidDigestValue = (input: string): bigint => BigInt(`0x${bytesToHex(sha256(utf8ToBytes(input)))}`);

const getFortuneForCid = (cid: string): FortuneEntry => FORTUNE_ENTRIES[Number(getCidDigestValue(`fortune:${cid}`) % BigInt(FORTUNE_ENTRIES.length))];

const rollDiceForCid = (spec: DiceSpec, cid: string): DiceRoll => {
  const rolls = Array.from({ length: spec.count }, (_, index) => Number(getCidDigestValue(`dice:${cid}:${index}`) % BigInt(spec.sides)) + 1);
  return { ...spec, rolls, total: rolls.reduce((sum, roll) => sum + roll, 0) + spec.modifier };
};

const getDiceRollText = (diceRoll: DiceRoll): string => {
  const rolls = diceRoll.rolls.join(', ');
  const total = diceRoll.count > 1 || diceRoll.modifier !== 0 ? ` = ${diceRoll.total}` : '';
  return `Rolled ${rolls}${diceRoll.modifierText}${total} (${diceRoll.count}d${diceRoll.sides}${diceRoll.modifierText})`;
};

export interface PostOptionResults {
  /** The comment with every fortune and dice marker its board reads removed. */
  content: string;
  diceText?: string;
  fortune?: FortuneEntry;
}

export interface PostOptionResultsInput {
  /** Absent while the post is pending, so no result shows until the board has stored it. */
  cid?: string;
  timestamp?: number;
  /** The 5chan directory of the post's own board, so a post reads the same wherever it shows. */
  directoryCode: string | undefined;
  /** An author edit could add a marker after the CID is known, so edited posts show no result. */
  isEdited: boolean;
}

/** Reads the fortune and dice the post asked for and removes their markers from the displayed comment. */
export const getPostOptionResults = ({ content, cid, timestamp, directoryCode, isEdited }: PostOptionResultsInput & { content: string }): PostOptionResults => {
  const markerTypes = getMarkerTypes(directoryCode, timestamp);
  if (!content || (!markerTypes.dice && !markerTypes.fortune)) {
    return { content };
  }

  const { diceMarkers, fortuneMarkers } = findMarkers(content, markerTypes);
  const results: PostOptionResults = { content: stripMarkersUntilStable(content, markerTypes) };
  if (isEdited) {
    return results;
  }

  const diceMarker = diceMarkers[0];
  if (markerTypes.storedOnly) {
    if (diceMarker?.storedText) results.diceText = diceMarker.storedText;
    if (fortuneMarkers[0]?.storedFortune) results.fortune = fortuneMarkers[0].storedFortune;
    return results;
  }

  if (cid && diceMarker?.spec) results.diceText = getDiceRollText(rollDiceForCid(diceMarker.spec, cid));
  if (cid && fortuneMarkers.length > 0) results.fortune = getFortuneForCid(cid);
  return results;
};
