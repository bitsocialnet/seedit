import { ComponentProps, lazy, Suspense } from 'react';
import { loadMarkdown } from './load-markdown';

const Markdown = lazy(loadMarkdown);

const LazyMarkdown = (props: ComponentProps<typeof Markdown>) => (
  <Suspense fallback={null}>
    <Markdown {...props} />
  </Suspense>
);

export default LazyMarkdown;
