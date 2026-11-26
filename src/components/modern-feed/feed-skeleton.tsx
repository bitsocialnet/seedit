import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import type { ResponsiveBones } from 'boneyard-js';
import { configureBoneyard, Skeleton } from 'boneyard-js/react';
import compactFeedBones from '../../data/bones/modern-feed-compact.bones.json';
import feedBones from '../../data/bones/modern-feed.bones.json';
import type { ModernFeedView } from '../../stores/use-modern-feed-view-store';
import ModernPostCard, { ModernCompactPost } from '../modern-post-card';
import styles from './modern-feed.module.css';

// boneyard takes the shimmer highlight only as a global setting; the theme token keeps it right in light and dark.
configureBoneyard({ shimmerColor: 'var(--m-border-strong)', darkShimmerColor: 'var(--m-border-strong)' });

const FIXTURE_TIMESTAMP = 1767225600;

const fixtureAuthor = (name: string) => ({ address: `${name}.bso`, shortAddress: `${name}.bso` });

/** Posts shaped like a typical feed: a text post, an image post and a link post. */
const getFixturePosts = (): Comment[] => [
  {
    cid: 'boneyard-fixture-text',
    communityAddress: 'skeleton.bso',
    author: fixtureAuthor('alice'),
    timestamp: FIXTURE_TIMESTAMP,
    title: 'A post title long enough to wrap onto a second line on a phone',
    content: 'The first lines of the post, shown as a preview under its title so the feed gives a sense of what it says before opening it.',
    upvoteCount: 12,
    downvoteCount: 1,
    replyCount: 4,
  },
  {
    cid: 'boneyard-fixture-image',
    communityAddress: 'skeleton.bso',
    author: fixtureAuthor('bob'),
    timestamp: FIXTURE_TIMESTAMP,
    title: 'An image post',
    // a local image, so the capture does not wait on the network
    link: new URL('assets/not-found/not-found-2.png', window.location.href).href,
    linkWidth: 1200,
    linkHeight: 900,
    upvoteCount: 30,
    downvoteCount: 2,
    replyCount: 9,
  },
  {
    cid: 'boneyard-fixture-link',
    communityAddress: 'skeleton.bso',
    author: fixtureAuthor('carol'),
    timestamp: FIXTURE_TIMESTAMP,
    title: 'A link post',
    link: 'https://example.com/article',
    upvoteCount: 5,
    downvoteCount: 0,
    replyCount: 1,
  },
];

/** Rendered only while `yarn bones:build` captures the skeleton from real post cards. */
const FeedFixture = () => (
  <>
    {getFixturePosts().map((post) => (
      <ModernPostCard key={post.cid} post={post} />
    ))}
  </>
);

/** The compact view's fixture: rows are short, so it takes the fixture posts twice to fill a screen as the cards do. */
const CompactFeedFixture = () => (
  <>
    {[...getFixturePosts(), ...getFixturePosts().map((post) => ({ ...post, cid: `${post.cid}-again` }))].map((post) => (
      <ModernCompactPost key={post.cid} post={post} />
    ))}
  </>
);

const skeletons = {
  card: { name: 'modern-feed', bones: feedBones, fixture: <FeedFixture /> },
  compact: { name: 'modern-feed-compact', bones: compactFeedBones, fixture: <CompactFeedFixture /> },
};

/**
 * Placeholder posts where a feed's first posts will appear, as cards or as compact rows. boneyard captured their
 * shapes from real posts (see the fixtures); the bones use the modern theme's colors, so they follow light and dark.
 */
const FeedSkeleton = ({ view = 'card' }: { view?: ModernFeedView }) => (
  <Skeleton
    name={skeletons[view].name}
    loading
    initialBones={skeletons[view].bones as ResponsiveBones}
    fixture={skeletons[view].fixture}
    // the meta line's separators would otherwise become slivers
    snapshotConfig={{ excludeSelectors: ['[data-skeleton-skip]'] }}
    // the feed is a column of an app shell, so bones are picked by viewport width, as they were captured
    select='viewport'
    animate='shimmer'
    color='var(--m-surface-raised)'
    darkColor='var(--m-surface-raised)'
    boneClass={styles.bone}
    className={styles.skeleton}
  >
    {null}
  </Skeleton>
);

export default FeedSkeleton;
