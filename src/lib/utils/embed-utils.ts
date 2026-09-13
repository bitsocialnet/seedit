// Host registry shared by the Embed component and by link media-type detection in media-utils.
export const youtubeHosts = new Set<string>([
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'm.youtube.com',
  'music.youtube.com',
  // working Invidious instances - https://docs.invidious.io/instances/ - https://uptime.invidious.io/
  'yewtu.be',
  'inv.nadeko.net',
  'yt.artemislena.eu',
  'invidious.nerdvpn.de',
]);
export const xHosts = new Set<string>(['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com']);
export const redditHosts = new Set<string>(['reddit.com', 'www.reddit.com', 'old.reddit.com']);
export const twitchHosts = new Set<string>(['twitch.tv', 'www.twitch.tv']);
export const tiktokHosts = new Set<string>(['tiktok.com', 'www.tiktok.com']);
export const instagramHosts = new Set<string>(['instagram.com', 'www.instagram.com']);
export const odyseeHosts = new Set<string>(['odysee.com', 'www.odysee.com']);
export const bitchuteHosts = new Set<string>(['bitchute.com', 'www.bitchute.com']);
export const streamableHosts = new Set<string>(['streamable.com', 'www.streamable.com']);
export const spotifyHosts = new Set<string>(['spotify.com', 'www.spotify.com', 'open.spotify.com']);
export const soundcloudHosts = new Set<string>(['soundcloud.com', 'www.soundcloud.com', 'on.soundcloud.com', 'api.soundcloud.com', 'w.soundcloud.com']);

const canEmbedHosts = new Set<string>([
  ...youtubeHosts,
  ...xHosts,
  ...redditHosts,
  ...twitchHosts,
  ...tiktokHosts,
  ...instagramHosts,
  ...odyseeHosts,
  ...bitchuteHosts,
  ...soundcloudHosts,
  ...streamableHosts,
  ...spotifyHosts,
]);

export const canEmbed = (parsedUrl: URL): boolean => {
  if (parsedUrl.pathname.toLowerCase().endsWith('.pdf')) {
    return true;
  }

  if (redditHosts.has(parsedUrl.host)) {
    // Reddit posts are not embeddable if the URL does not include '/comments/'
    return parsedUrl.pathname.includes('/comments/');
  }

  return canEmbedHosts.has(parsedUrl.host) || (parsedUrl.host.startsWith('yt.') && parsedUrl.searchParams.has('v'));
};
