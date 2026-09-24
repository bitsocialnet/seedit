import { ComponentProps, Suspense, use } from 'react';
import type Markdown from './markdown';
import { getLoadedMarkdown, loadMarkdown } from './load-markdown';

type MarkdownProps = ComponentProps<typeof Markdown>;

const LoadedMarkdown = (props: MarkdownProps) => {
  const Component = getLoadedMarkdown() ?? use(loadMarkdown());
  return <Component {...props} />;
};

const LazyMarkdown = (props: MarkdownProps) => (
  <Suspense fallback={null}>
    <LoadedMarkdown {...props} />
  </Suspense>
);

export default LazyMarkdown;
