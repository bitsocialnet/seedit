import { isAnalyticsEnabled, type PageViewOptions, type PostingAnalyticsEvent, type PostingAnalyticsKind } from './shared';

export { isAnalyticsEnabled, type PageViewOptions, type PostingAnalyticsEvent, type PostingAnalyticsKind } from './shared';

let clientPromise: Promise<typeof import('./client')> | undefined;
const getClient = () => (clientPromise ??= import('./client'));

// Keep both the SDK and its route normalization out of the startup graph. Failed
// downloads/dispatches are ignored, so analytics cannot interrupt browsing/posting.
export const trackPageView = (pathname: string, options?: PageViewOptions): void => {
  if (!isAnalyticsEnabled()) return;
  void getClient()
    .then((client) => client.trackPageView(pathname, options))
    .catch(() => {});
};

export const trackPostingEvent = (event: PostingAnalyticsEvent, context: { kind: PostingAnalyticsKind }): void => {
  if (!isAnalyticsEnabled()) return;
  void getClient()
    .then((client) => client.trackPostingEvent(event, context))
    .catch(() => {});
};
