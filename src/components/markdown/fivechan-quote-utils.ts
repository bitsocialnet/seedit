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

const getFivechanQuoteMarkdown = (reference: FivechanQuoteReference) => {
  const boardPath = reference.board ? `/${encodeURIComponent(reference.board)}` : '';
  return `[5chan quote](${FIVECHAN_QUOTE_PATH}${boardPath}/${reference.number})`;
};

export const preprocessFivechanQuoteLines = (content: string): string => {
  let activeFence: string | undefined;

  return content
    .split('\n')
    .map((line) => {
      const fence = line.match(MARKDOWN_FENCE_REGEX)?.[1];
      if (activeFence) {
        if (fence?.[0] === activeFence[0] && fence.length >= activeFence.length) activeFence = undefined;
        return line;
      }
      if (fence) {
        activeFence = fence;
        return line;
      }

      const crossBoardMatch = line.match(FIVECHAN_CROSS_BOARD_QUOTE_LINE_REGEX);
      if (crossBoardMatch) {
        const [, indentation, board, numberText] = crossBoardMatch;
        const raw = `>>>/${board}/${numberText}`;
        return line.replace(FIVECHAN_CROSS_BOARD_QUOTE_LINE_REGEX, `${indentation}${getFivechanQuoteMarkdown({ board, number: Number(numberText), raw })}`);
      }

      const numberMatch = line.match(FIVECHAN_NUMBER_QUOTE_LINE_REGEX);
      if (numberMatch) {
        const [, indentation, numberText] = numberMatch;
        const raw = `>>${numberText}`;
        return line.replace(FIVECHAN_NUMBER_QUOTE_LINE_REGEX, `${indentation}${getFivechanQuoteMarkdown({ number: Number(numberText), raw })}`);
      }

      return line;
    })
    .join('\n');
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
