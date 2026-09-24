import type Markdown from './markdown';

// The markdown pipeline (remark/rehype, parse5 for raw HTML) is ~0.5 MB of JavaScript. It is
// only needed once peer content arrives, so it loads after the first render instead of before it.
let loadedMarkdown: typeof Markdown | undefined;
let markdownPromise: Promise<typeof Markdown | undefined> | undefined;
let markdownFailed = false;

// Resolves to the component, or to undefined when the chunk fails to load, so renders can fall back
// to plain text instead of throwing. The settled promise stays cached because renders that suspend
// on it need the same promise when React retries them; pass retryFailed from a user action (not a
// render) to request a failed chunk again.
export const loadMarkdown = ({ retryFailed = false } = {}) => {
  if (retryFailed && markdownFailed) {
    markdownPromise = undefined;
    markdownFailed = false;
  }
  markdownPromise ||= import('./markdown').then(
    (module) => (loadedMarkdown = module.default),
    () => {
      markdownFailed = true;
      return undefined;
    },
  );
  return markdownPromise;
};

// Once loaded, markdown renders synchronously, like an eager import (React.lazy would still
// suspend on its own first render).
export const getLoadedMarkdown = () => loadedMarkdown;

export const preloadMarkdown = () => {
  void loadMarkdown();
};
