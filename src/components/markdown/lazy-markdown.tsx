import { ComponentProps, Suspense, use } from 'react';
import type Markdown from './markdown';
import { getLoadedMarkdown, loadMarkdown } from './load-markdown';
import { stripPostOptionMarkers } from '../../lib/utils/post-option-markers';

type MarkdownProps = ComponentProps<typeof Markdown>;

const LoadedMarkdown = (props: MarkdownProps) => {
  const Component = getLoadedMarkdown() ?? use(loadMarkdown());
  if (Component) {
    // oxlint-disable-next-line react/static-components -- Component is the module-level Markdown export resolved from a cached chunk import, not created per render
    return <Component {...props} />;
  }
  // If the chunk could not load, show the text unformatted rather than failing the page, still without the 5chan
  // fortune and dice markers its board reads (their results need the chunk's sha256).
  const { postOptions } = props;
  const content = postOptions ? stripPostOptionMarkers(props.content, { directoryCode: postOptions.directoryCode, timestamp: postOptions.timestamp }) : props.content;
  return <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>;
};

const LazyMarkdown = (props: MarkdownProps) => (
  <Suspense fallback={null}>
    <LoadedMarkdown {...props} />
  </Suspense>
);

export default LazyMarkdown;
