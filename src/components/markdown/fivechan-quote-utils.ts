const FIVECHAN_QUOTE_PATH = '/__seedit-fivechan-quote';
const FIVECHAN_NUMBER_QUOTE_LINE_REGEX = /^( {0,3})>>(\d+)(?![\d/])/;
const FIVECHAN_CROSS_BOARD_QUOTE_LINE_REGEX = /^( {0,3})>>>\/([A-Za-z0-9.-]+)\/(\d+)(?!\d)/;
const FIVECHAN_BOARD_REGEX = /^[A-Za-z0-9.-]+$/;
const MARKDOWN_FENCE_REGEX = /^ {0,3}(`{3,}|~{3,})/;

export type FivechanQuoteReference = {
  board?: string;
  number: number;
  raw: string;
};

type FivechanQuoteLineMatch = {
  indentation: string;
  // The matched quote prefix, indentation included; the rest of the line follows it.
  match: string;
  reference: FivechanQuoteReference;
};

const getFivechanQuoteMarkdown = (reference: FivechanQuoteReference) => {
  const boardPath = reference.board ? `/${encodeURIComponent(reference.board)}` : '';
  return `[5chan quote](${FIVECHAN_QUOTE_PATH}${boardPath}/${reference.number})`;
};

const matchFivechanQuoteLine = (line: string): FivechanQuoteLineMatch | undefined => {
  const crossBoardMatch = line.match(FIVECHAN_CROSS_BOARD_QUOTE_LINE_REGEX);
  if (crossBoardMatch) {
    const [match, indentation, board, numberText] = crossBoardMatch;
    return { indentation, match, reference: { board, number: Number(numberText), raw: `>>>/${board}/${numberText}` } };
  }

  const numberMatch = line.match(FIVECHAN_NUMBER_QUOTE_LINE_REGEX);
  if (numberMatch) {
    const [match, indentation, numberText] = numberMatch;
    return { indentation, match, reference: { number: Number(numberText), raw: `>>${numberText}` } };
  }

  return undefined;
};

// Walks the content line by line, leaving fenced code untouched, and lets `mapQuoteLine` rewrite each 5chan quote line.
// Returning `undefined` from `mapQuoteLine` drops that line.
const mapFivechanQuoteLines = (content: string, mapQuoteLine: (line: string, quoteLine: FivechanQuoteLineMatch) => string | undefined): string => {
  let activeFence: string | undefined;
  const lines: string[] = [];

  for (const line of content.split('\n')) {
    const fence = line.match(MARKDOWN_FENCE_REGEX)?.[1];
    if (activeFence) {
      if (fence?.[0] === activeFence[0] && fence.length >= activeFence.length) activeFence = undefined;
      lines.push(line);
      continue;
    }
    if (fence) {
      activeFence = fence;
      lines.push(line);
      continue;
    }

    const quoteLine = matchFivechanQuoteLine(line);
    const mappedLine = quoteLine ? mapQuoteLine(line, quoteLine) : line;
    if (mappedLine !== undefined) lines.push(mappedLine);
  }

  return lines.join('\n');
};

export const getFivechanQuoteReferences = (content: string): FivechanQuoteReference[] => {
  const references: FivechanQuoteReference[] = [];
  mapFivechanQuoteLines(content, (line, { reference }) => {
    references.push(reference);
    return line;
  });
  return references;
};

// 5chan threads are flat, so a `>>N` quote is the only visible link between a reply and the comment it answers, and 5chan
// pre-fills a quote of the parent whenever someone replies to a comment. Seedit nests each reply under its parent instead,
// so when every quote in a reply points at its own parent (`parentNumber`, passed only when that parent is rendered right
// above the reply) the quote repeats what the thread layout already shows and is stripped rather than rendered as
// "[quoting u/...]". Quotes that add context are kept: another comment, several targets, or a cross-board reference.
export const preprocessFivechanQuoteLines = (content: string, parentNumber?: number): string => {
  const references = getFivechanQuoteReferences(content);
  const quotesOnlyParent = parentNumber !== undefined && references.length > 0 && references.every((reference) => !reference.board && reference.number === parentNumber);

  return mapFivechanQuoteLines(content, (line, { indentation, match, reference }) => {
    const rest = line.slice(match.length);
    if (quotesOnlyParent) {
      const remainder = rest.trim();
      return remainder ? `${indentation}${remainder}` : undefined;
    }
    return `${indentation}${getFivechanQuoteMarkdown(reference)}${rest}`;
  });
};

export const parseFivechanQuoteHref = (href: string): FivechanQuoteReference | undefined => {
  if (!href.startsWith(`${FIVECHAN_QUOTE_PATH}/`)) return undefined;
  const path = href.slice(FIVECHAN_QUOTE_PATH.length + 1).split('/');

  const numberText = path.at(-1);
  const number = Number(numberText);
  if (!numberText || !Number.isSafeInteger(number) || number <= 0) return undefined;

  let board: string | undefined;
  try {
    board = path.length === 2 ? decodeURIComponent(path[0]) : undefined;
  } catch {
    return undefined;
  }
  if (path.length > 2 || (path.length === 2 && (!board || !FIVECHAN_BOARD_REGEX.test(board)))) return undefined;

  return {
    board,
    number,
    raw: board ? `>>>/${board}/${number}` : `>>${number}`,
  };
};
