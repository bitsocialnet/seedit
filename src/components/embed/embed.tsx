import styles from './embed.module.css';
import {
  bitchuteHosts,
  instagramHosts,
  odyseeHosts,
  redditHosts,
  soundcloudHosts,
  spotifyHosts,
  streamableHosts,
  tiktokHosts,
  twitchHosts,
  xHosts,
  youtubeHosts,
} from '../../lib/utils/embed-utils';

interface EmbedProps {
  url: string;
}

const Embed = ({ url }: EmbedProps) => {
  const parsedUrl = new URL(url);

  if (parsedUrl.pathname.toLowerCase().endsWith('.pdf')) {
    return <PdfEmbed parsedUrl={parsedUrl} />;
  }
  if (youtubeHosts.has(parsedUrl.host) || (parsedUrl.host.startsWith('yt.') && parsedUrl.searchParams.has('v'))) {
    return <YoutubeEmbed parsedUrl={parsedUrl} />;
  }
  if (xHosts.has(parsedUrl.host)) {
    return <XEmbed parsedUrl={parsedUrl} />;
  }
  if (redditHosts.has(parsedUrl.host)) {
    return <RedditEmbed parsedUrl={parsedUrl} />;
  }
  if (twitchHosts.has(parsedUrl.host)) {
    return <TwitchEmbed parsedUrl={parsedUrl} />;
  }
  if (tiktokHosts.has(parsedUrl.host)) {
    return <TiktokEmbed parsedUrl={parsedUrl} />;
  }
  if (instagramHosts.has(parsedUrl.host)) {
    return <InstagramEmbed parsedUrl={parsedUrl} />;
  }
  if (odyseeHosts.has(parsedUrl.host)) {
    return <OdyseeEmbed parsedUrl={parsedUrl} />;
  }
  if (bitchuteHosts.has(parsedUrl.host)) {
    return <BitchuteEmbed parsedUrl={parsedUrl} />;
  }
  if (streamableHosts.has(parsedUrl.host)) {
    return <StreamableEmbed parsedUrl={parsedUrl} />;
  }
  if (spotifyHosts.has(parsedUrl.host)) {
    return <SpotifyEmbed parsedUrl={parsedUrl} />;
  }
  if (soundcloudHosts.has(parsedUrl.host)) {
    return <SoundcloudEmbed parsedUrl={parsedUrl} />;
  }
};

interface EmbedComponentProps {
  parsedUrl: URL;
}

const YoutubeEmbed = ({ parsedUrl }: EmbedComponentProps) => {
  let embedSrc = '';

  const isInvidious = parsedUrl.host !== 'youtube.com' && parsedUrl.host !== 'www.youtube.com' && parsedUrl.host !== 'youtu.be' && parsedUrl.host !== 'www.youtu.be';

  if (parsedUrl.searchParams.has('list')) {
    const playlistId = parsedUrl.searchParams.get('list');
    embedSrc = `https://www.youtube.com/embed/videoseries?list=${playlistId}`;
  } else {
    let videoId = parsedUrl.searchParams.get('v');

    if (!videoId) {
      if (parsedUrl.host.includes('youtu.be')) {
        videoId = parsedUrl.pathname.substring(1);
      } else if (parsedUrl.pathname.includes('/shorts/')) {
        videoId = parsedUrl.pathname.split('/shorts/')[1];
      } else if (isInvidious) {
        if (parsedUrl.pathname.startsWith('/watch')) {
          videoId = parsedUrl.searchParams.get('v');
        } else {
          videoId = parsedUrl.pathname.split('/').pop() || null;
        }
      }
    }

    if (videoId) {
      embedSrc = `https://www.youtube.com/embed/${videoId}`;
    }
  }
  if (embedSrc) {
    return (
      <iframe
        className={styles.videoEmbed}
        height='100%'
        width='100%'
        referrerPolicy='origin'
        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
        allowFullScreen
        title={parsedUrl.href}
        src={embedSrc}
      />
    );
  }
  return null;
};

const XEmbed = ({ parsedUrl }: EmbedComponentProps) => {
  return (
    <iframe
      className={styles.xEmbed}
      height='100%'
      width='100%'
      referrerPolicy='no-referrer'
      allow='accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share'
      title={parsedUrl.href}
      srcDoc={`
      <blockquote class="twitter-tweet" data-theme="dark">
        <a href="${parsedUrl.href.replace('x.com', 'twitter.com')}"></a>
      </blockquote>
      <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
    `}
    />
  );
};

const RedditEmbed = ({ parsedUrl }: EmbedComponentProps) => {
  return (
    <iframe
      className={styles.redditEmbed}
      height='100%'
      width='100%'
      referrerPolicy='no-referrer'
      allow='accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share'
      title={parsedUrl.href}
      srcDoc={`
      <style>
        /* fix reddit iframe being centered */
        iframe {
          margin: 0!important;
        }
      </style>
      <blockquote class="reddit-embed-bq" style="height:240px" data-embed-theme="dark">
        <a href="${parsedUrl.href}"></a>    
      </blockquote>
      <script async src="https://embed.reddit.com/widgets.js" charset="UTF-8"></script>
    `}
    />
  );
};

const TwitchEmbed = ({ parsedUrl }: EmbedComponentProps) => {
  let iframeUrl;
  if (parsedUrl.pathname.startsWith('/videos/')) {
    const videoId = parsedUrl.pathname.replace('/videos/', '');
    iframeUrl = `https://player.twitch.tv/?video=${videoId}&parent=${window.location.hostname}`;
  } else {
    const channel = parsedUrl.pathname.replaceAll('/', '');
    iframeUrl = `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`;
  }
  return (
    <iframe
      className={styles.videoEmbed}
      height='100%'
      width='100%'
      referrerPolicy='no-referrer'
      allow='accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share'
      allowFullScreen
      title={parsedUrl.href}
      src={iframeUrl}
    />
  );
};

const TiktokEmbed = ({ parsedUrl }: EmbedComponentProps) => {
  const videoId = parsedUrl.pathname.replace(/.+\/video\//, '').replaceAll('/', '');
  return (
    <iframe
      className={styles.tiktokEmbed}
      height='100%'
      width='100%'
      referrerPolicy='no-referrer'
      allow='accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share'
      title={parsedUrl.href}
      srcDoc={`
      <blockquote class="tiktok-embed" data-video-id="${videoId}">
        <a></a>
      </blockquote> 
      <script async src="https://www.tiktok.com/embed.js"></script>
    `}
    />
  );
};

const InstagramEmbed = ({ parsedUrl }: EmbedComponentProps) => {
  const pathNames = parsedUrl.pathname.replace(/\/+$/, '').split('/');
  const id = pathNames[pathNames.length - 1];
  return (
    <iframe
      className={styles.instagramEmbed}
      height='100%'
      width='100%'
      referrerPolicy='no-referrer'
      allow='accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share'
      title={parsedUrl.href}
      srcDoc={`
      <blockquote class="instagram-media">
        <a href="https://www.instagram.com/p/${id}/"></a>
      </blockquote>
      <script async src="//www.instagram.com/embed.js"></script>
    `}
    />
  );
};

const OdyseeEmbed = ({ parsedUrl }: EmbedComponentProps) => {
  const iframeUrl = `https://odysee.com/$/embed${parsedUrl.pathname}`;
  return (
    <iframe
      className={styles.videoEmbed}
      height='100%'
      width='100%'
      referrerPolicy='no-referrer'
      allow='accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share'
      allowFullScreen
      title={parsedUrl.href}
      src={iframeUrl}
    />
  );
};

const BitchuteEmbed = ({ parsedUrl }: EmbedComponentProps) => {
  const videoId = parsedUrl.pathname.replace(/\/video\//, '').replaceAll('/', '');
  return (
    <iframe
      className={styles.videoEmbed}
      height='100%'
      width='100%'
      referrerPolicy='no-referrer'
      allow='accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share'
      allowFullScreen
      title={parsedUrl.href}
      src={`https://www.bitchute.com/embed/${videoId}/`}
    />
  );
};

const StreamableEmbed = ({ parsedUrl }: EmbedComponentProps) => {
  const videoId = parsedUrl.pathname.replaceAll('/', '');
  return (
    <iframe
      className={styles.videoEmbed}
      height='100%'
      width='100%'
      referrerPolicy='no-referrer'
      allow='accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share'
      allowFullScreen
      title={parsedUrl.href}
      src={`https://streamable.com/e/${videoId}`}
    />
  );
};

const SpotifyEmbed = ({ parsedUrl }: EmbedComponentProps) => {
  const iframeUrl = `https://open.spotify.com/embed${parsedUrl.pathname}?theme=0`;
  return (
    <iframe
      className={styles.audioEmbed}
      height='100%'
      width='100%'
      referrerPolicy='no-referrer'
      allow='accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share'
      allowFullScreen
      title={parsedUrl.href}
      src={iframeUrl}
    />
  );
};

// not officially documented https://stackoverflow.com/questions/20870270/how-to-get-soundcloud-embed-code-by-soundcloud-com-url
const SoundcloudEmbed = ({ parsedUrl }: EmbedComponentProps) => {
  const isSet = parsedUrl.pathname.includes('/sets/');
  return (
    <iframe
      className={isSet ? styles.soundcloudSetsEmbed : styles.soundcloudEmbed}
      height='100%'
      width='100%'
      referrerPolicy='no-referrer'
      allow='accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share'
      allowFullScreen
      title={parsedUrl.href}
      src={`https://w.soundcloud.com/player/?url=${parsedUrl.href}`}
    />
  );
};

const PdfEmbed = ({ parsedUrl }: EmbedComponentProps) => {
  return <iframe className={styles.pdfEmbed} height='100%' width='100%' referrerPolicy='origin' allowFullScreen title={parsedUrl.href} src={parsedUrl.href} />;
};

export default Embed;
