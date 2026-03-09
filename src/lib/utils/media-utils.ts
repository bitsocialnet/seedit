import localForageLru from '@bitsocialnet/bitsocial-react-hooks/dist/lib/localforage-lru/index.js';
import { Comment } from '@bitsocialnet/bitsocial-react-hooks';
import extName from 'ext-name';
import { canEmbed } from '../../components/post/embed';
import memoize from 'memoizee';
import { isValidURL } from './url-utils';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export interface CommentMediaInfo {
  url: string;
  type: string;
  thumbnail?: string;
  patternThumbnailUrl?: string;
}

export const getHasThumbnail = (commentMediaInfo: CommentMediaInfo | undefined, link: string | undefined): boolean => {
  const iframeThumbnail = commentMediaInfo?.patternThumbnailUrl || commentMediaInfo?.thumbnail;
  return link &&
    commentMediaInfo &&
    (commentMediaInfo.type === 'image' ||
      commentMediaInfo.type === 'video' ||
      commentMediaInfo.type === 'gif' ||
      (commentMediaInfo.type === 'webpage' && commentMediaInfo.thumbnail) ||
      (commentMediaInfo.type === 'iframe' && iframeThumbnail) ||
      commentMediaInfo.type === 'pdf')
    ? true
    : false;
};

const getYouTubeVideoId = (url: URL): string | null => {
  if (url.host.includes('youtu.be')) {
    return url.pathname.slice(1);
  } else if (url.pathname.includes('/shorts/')) {
    return url.pathname.split('/shorts/')[1].split('/')[0];
  } else if (url.searchParams.has('v')) {
    return url.searchParams.get('v');
  }
  return null;
};

const getPatternThumbnailUrl = (url: URL): string | undefined => {
  const videoId = getYouTubeVideoId(url);
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/0.jpg`;
  }
  if (url.host.includes('streamable.com')) {
    const videoId = url.pathname.split('/')[1];
    return `https://cdn-cf-east.streamable.com/image/${videoId}.jpg`;
  }
};

// some sites don't show thumbnails, so the backend-side thumbnail fetching needs to be  disabled, or it might fetch non-thumbnails such as emojis
const THUMBNAIL_BLACKLISTED_DOMAINS = ['twitter.com', 'x.com'];

const isThumbnailDomainBlacklisted = (link: string | undefined): boolean => {
  if (!link) {
    return false;
  }

  try {
    const hostname = new URL(link).hostname.toLowerCase();
    return THUMBNAIL_BLACKLISTED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch (error) {
    console.error('Error parsing link while checking thumbnail blacklist:', error);
    return false;
  }
};

export const getLinkMediaInfo = memoize(
  (link: string): CommentMediaInfo | undefined => {
    if (!isValidURL(link)) {
      return;
    }
    const url = new URL(link);
    let patternThumbnailUrl: string | undefined;
    let type: string = 'webpage';
    let mime: string | undefined;

    if (url.pathname === '/_next/image' && url.search.startsWith('?url=')) {
      return { url: link, type: 'image' };
    }

    try {
      if (url.pathname.toLowerCase().endsWith('.pdf')) {
        type = 'pdf';
      } else {
        mime = extName(url.pathname.toLowerCase().replace('/', ''))[0]?.mime;
        if (mime) {
          if (mime.startsWith('image')) {
            type = mime === 'image/gif' ? 'gif' : 'image';
          } else if (mime.startsWith('video')) {
            type = 'video';
          } else if (mime.startsWith('audio')) {
            type = 'audio';
          }
        }

        if (type === 'webpage' && !url.pathname.includes('.')) {
          if (canEmbed(url) || url.host.startsWith('yt.')) {
            type = 'iframe';
            patternThumbnailUrl = getPatternThumbnailUrl(url);
          }
        } else if (type !== 'pdf' && (canEmbed(url) || url.host.startsWith('yt.'))) {
          type = 'iframe';
          patternThumbnailUrl = getPatternThumbnailUrl(url);
        }
      }
    } catch (e) {
      console.error(e);
    }

    return { url: link, type, patternThumbnailUrl };
  },
  { max: 1000 },
);

export const getCommentMediaInfo = (comment: Comment): CommentMediaInfo | undefined => {
  if (!comment?.thumbnailUrl && !comment?.link) {
    return;
  }
  const linkInfo = comment.link ? getLinkMediaInfo(comment.link) : undefined;
  if (linkInfo) {
    const linkInfoClone: CommentMediaInfo = { ...linkInfo };
    if (isThumbnailDomainBlacklisted(comment.link)) {
      linkInfoClone.thumbnail = undefined;
      linkInfoClone.patternThumbnailUrl = undefined;
    } else if (comment.thumbnailUrl) {
      linkInfoClone.thumbnail = comment.thumbnailUrl;
    }
    return linkInfoClone;
  }
  return;
};

const fetchWebpageThumbnail = async (url: string): Promise<string | undefined> => {
  try {
    let html: string;
    const MAX_HTML_SIZE = 1024 * 1024;
    const TIMEOUT = 5000;

    if (Capacitor.isNativePlatform()) {
      // in the native app, the Capacitor HTTP plugin is used to fetch the thumbnail
      const response = await CapacitorHttp.get({
        url,
        readTimeout: TIMEOUT,
        connectTimeout: TIMEOUT,
        responseType: 'text',
        headers: { Accept: 'text/html', Range: `bytes=0-${MAX_HTML_SIZE - 1}` },
      });
      html = response.data.slice(0, MAX_HTML_SIZE);
    } else {
      // some sites have CORS access, from which the thumbnail can be fetched client-side, which is helpful if subplebbit.settings.fetchThumbnailUrls is false
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'text/html' },
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body?.getReader();
      let result = '';
      while (true) {
        const { done, value } = await reader!.read();
        if (done || result.length >= MAX_HTML_SIZE) break;
        result += new TextDecoder().decode(value);
      }
      html = result.slice(0, MAX_HTML_SIZE);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Try to find Open Graph image
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage && ogImage.getAttribute('content')) {
      return ogImage.getAttribute('content')!;
    }

    // If no Open Graph image, try to find the first image
    const firstImage = doc.querySelector('img');
    if (firstImage && firstImage.getAttribute('src')) {
      return new URL(firstImage.getAttribute('src')!, url).href;
    }

    return undefined;
  } catch (error) {
    console.error('Error fetching webpage thumbnail:', error);
    return undefined;
  }
};

const thumbnailUrlsDb = localForageLru.createInstance({ name: 'seeditThumbnailUrls', size: 500 });

export const getCachedThumbnail = async (url: string): Promise<string | null> => {
  return await thumbnailUrlsDb.getItem(url);
};

export const setCachedThumbnail = async (url: string, thumbnail: string): Promise<void> => {
  await thumbnailUrlsDb.setItem(url, thumbnail);
};

export const fetchWebpageThumbnailIfNeeded = async (commentMediaInfo: CommentMediaInfo): Promise<CommentMediaInfo> => {
  if (commentMediaInfo.type === 'webpage' && !commentMediaInfo.thumbnail) {
    const cachedThumbnail = await getCachedThumbnail(commentMediaInfo.url);
    if (cachedThumbnail) {
      return { ...commentMediaInfo, thumbnail: cachedThumbnail };
    }
    const thumbnail = await fetchWebpageThumbnail(commentMediaInfo.url);
    if (thumbnail) {
      await setCachedThumbnail(commentMediaInfo.url, thumbnail);
    }
    return { ...commentMediaInfo, thumbnail };
  }
  return commentMediaInfo;
};
