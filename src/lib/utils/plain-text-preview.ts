// Markdown syntax adds characters, so read somewhat more than the excerpt keeps.
const SOURCE_LENGTH_PER_PREVIEW_CHARACTER = 4;

// A short plain-text excerpt of markdown for feed previews, where rendering the full markdown would cost too much per row.
// Only the start of the content is parsed: peer content can be up to a megabyte, and the patterns below scan to the end
// of a line for every unclosed marker.
export const getPlainTextPreview = (markdown: string | undefined, maxLength = 400): string => {
  if (!markdown) return '';
  const text = markdown
    .slice(0, maxLength * SOURCE_LENGTH_PER_PREVIEW_CHARACTER)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(?:#{1,6}|>+|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|~~|`|\*|_)(?=\S)([^\n]*?\S)\1/g, '$2')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
};
