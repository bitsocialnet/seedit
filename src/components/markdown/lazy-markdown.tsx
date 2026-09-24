import { ComponentProps, Suspense, use } from 'react';
import type Markdown from './markdown';
import { getLoadedMarkdown, loadMarkdown } from './load-markdown';

type MarkdownProps = ComponentProps<typeof Markdown>;

const LoadedMarkdown = (props: MarkdownProps) => {
  const Component = getLoadedMarkdown() ?? use(loadMarkdown());
  // If the chunk could not load, show the text unformatted rather than failing the page.
  return Component ? <Component {...props} /> : <p style={{ whiteSpace: 'pre-wrap' }}>{props.content}</p>;
};

const LazyMarkdown = (props: MarkdownProps) => (
  <Suspense fallback={null}>
    <LoadedMarkdown {...props} />
  </Suspense>
);

export default LazyMarkdown;
