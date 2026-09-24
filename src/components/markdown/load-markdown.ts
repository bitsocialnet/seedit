import type Markdown from './markdown';

// The markdown pipeline (remark/rehype, parse5 for raw HTML) is ~0.5 MB of JavaScript. It is
// only needed once peer content arrives, so it loads after the first render instead of before it.
let loadedMarkdown: typeof Markdown | undefined;
let markdownPromise: Promise<typeof Markdown> | undefined;

export const loadMarkdown = () =>
  (markdownPromise ||= import('./markdown').then(
    (module) => (loadedMarkdown = module.default),
    (error) => {
      // Let a later render retry a failed chunk request.
      markdownPromise = undefined;
      throw error;
    },
  ));

// Once loaded, markdown renders synchronously, like an eager import (React.lazy would still
// suspend on its own first render).
export const getLoadedMarkdown = () => loadedMarkdown;

export const preloadMarkdown = () => {
  loadMarkdown().catch(() => {});
};
