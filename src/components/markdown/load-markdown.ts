// The markdown pipeline (remark/rehype, parse5 for raw HTML) is ~0.5 MB of JavaScript. It is
// only needed once peer content arrives, so it loads after the first render instead of before it.
export const loadMarkdown = () => import('./markdown');

export const preloadMarkdown = () => {
  void loadMarkdown();
};
