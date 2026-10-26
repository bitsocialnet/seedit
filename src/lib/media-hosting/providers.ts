import { FORGE_IMAGES_API_ORIGIN, FORGE_IMAGES_MEDIA_ORIGIN } from './forge-images-config';
import type { MediaFileKind, MediaHostingRuntime, ProviderId } from './types';

interface ProviderDefinition {
  id: ProviderId;
  label: string;
  homepageUrl: string;
  /** Image URLs used to detect whether this provider is reachable from the user's network. */
  availabilityProbeUrls: readonly string[];
  /** Runtimes where automated upload is supported (non-web = no interactive fallback) */
  supportedRuntimes: readonly MediaHostingRuntime[];
  /** Kinds of file the provider hosts behind a direct link. */
  fileKinds: readonly MediaFileKind[];
  /** The only formats it takes (MIME type to extensions), for a provider that rejects some formats of its kinds. */
  formats?: Readonly<Record<string, readonly string[]>>;
}

/** All media hosting providers with metadata. Array order is the settings display order. */
export const MEDIA_HOSTING_PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: 'forge',
    label: 'Forge Images',
    // The media host has no landing page, so link the Forge Images site.
    homepageUrl: 'https://images.bitsocialforge.com',
    // Both serve the same frozen 1x1 PNG: the pinned blob proves the media serve path,
    // health.png proves the upload API is healthy (it answers a non-image 503 otherwise).
    availabilityProbeUrls: [`${FORGE_IMAGES_MEDIA_ORIGIN}/2aa4fa20701cdd6d8d56046069001186b5267e3ee7d0ef618ad2f4a683723e11.png`, `${FORGE_IMAGES_API_ORIGIN}/health.png`],
    // A direct upload everywhere. Electron gets its Turnstile token from a main-process
    // window (electron/forge-turnstile.js); Android uploads from the WebView, not the plugin.
    supportedRuntimes: ['web', 'electron', 'android'],
    fileKinds: ['image', 'video'],
    // The API rejects every other image and video format (HEIC, AVIF, MOV and so on).
    formats: { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'image/gif': ['gif'], 'video/mp4': ['mp4'], 'video/webm': ['webm'] },
  },
  {
    id: 'catbox',
    label: 'Catbox',
    homepageUrl: 'https://catbox.moe',
    // Catbox's own favicon on the file host: an uploaded probe file can be emptied, which
    // fails the image load and marks catbox unavailable everywhere.
    availabilityProbeUrls: ['https://catbox.moe/pictures/logo.png', 'https://files.catbox.moe/favicon.ico'],
    // Not web: catbox's API sends no CORS headers, so a browser fetch always fails.
    supportedRuntimes: ['electron', 'android'],
    fileKinds: ['image', 'video', 'audio', 'pdf'],
  },
  {
    id: 'imgur',
    label: 'Imgur',
    homepageUrl: 'https://imgur.com',
    availabilityProbeUrls: ['https://s.imgur.com/images/favicon-32x32.png', 'https://i.imgur.com/YpB7qfa.jpg'],
    supportedRuntimes: ['electron', 'android'],
    fileKinds: ['image', 'video'],
  },
  {
    id: 'imgbb',
    label: 'ImgBB',
    homepageUrl: 'https://imgbb.com',
    availabilityProbeUrls: ['https://simgbb.com/images/logo.png', 'https://i.ibb.co/7Jsq00V5/spoiler.png'],
    supportedRuntimes: ['electron', 'android'],
    fileKinds: ['image'],
  },
] as const;

const providerById = new Map(MEDIA_HOSTING_PROVIDERS.map((provider) => [provider.id, provider]));

/** Providers with automated upload support on the given runtime, in settings display order. */
export function getRuntimeProviders(runtime: MediaHostingRuntime): readonly ProviderDefinition[] {
  return MEDIA_HOSTING_PROVIDERS.filter((provider) => provider.supportedRuntimes.includes(runtime));
}

export function getProviderLabel(provider: ProviderId): string {
  return providerById.get(provider)?.label ?? provider;
}

const FILE_KINDS: readonly MediaFileKind[] = ['image', 'video', 'audio', 'pdf'];

const FILE_KIND_MIME_TYPES: Record<MediaFileKind, string> = { image: 'image/*', video: 'video/*', audio: 'audio/*', pdf: 'application/pdf' };

const FILE_KIND_EXTENSIONS: Record<MediaFileKind, readonly string[]> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'bmp'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'm4v'],
  audio: ['mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac'],
  pdf: ['pdf'],
};

const getFileExtension = (fileName: string): string => fileName.split('.').pop()?.toLowerCase() ?? '';

/** The file's kind from its MIME type, or from its extension when the OS reports no MIME type or a generic one. */
export function getMediaFileKind(mimeType: string, fileName: string): MediaFileKind | null {
  if (mimeType === 'application/pdf') return 'pdf';
  const type = mimeType.split('/')[0];
  if (type === 'image' || type === 'video' || type === 'audio') return type;
  const extension = getFileExtension(fileName);
  return FILE_KINDS.find((kind) => FILE_KIND_EXTENSIONS[kind].includes(extension)) ?? null;
}

/** Kinds of file at least one of the providers hosts, in a fixed display order. */
export function getProvidersFileKinds(providers: readonly ProviderId[]): MediaFileKind[] {
  return FILE_KINDS.filter((kind) => providers.some((provider) => providerById.get(provider)?.fileKinds.includes(kind)));
}

/** File picker `accept` map (MIME type to extensions) of the formats at least one of the providers hosts. */
export function getProvidersAccept(providers: readonly ProviderId[]): Record<string, string[]> {
  const accept: Record<string, string[]> = {};
  for (const id of providers) {
    const provider = providerById.get(id);
    if (!provider) continue;
    const formats = provider.formats ?? Object.fromEntries(provider.fileKinds.map((kind) => [FILE_KIND_MIME_TYPES[kind], FILE_KIND_EXTENSIONS[kind]]));
    for (const [mimeType, extensions] of Object.entries(formats)) {
      accept[mimeType] = [...new Set([...(accept[mimeType] ?? []), ...extensions.map((extension) => `.${extension}`)])];
    }
  }
  return accept;
}

/** The providers that host this file. A file of unknown kind keeps them all and leaves the decision to each host. */
export function filterProvidersForFile(providers: readonly ProviderId[], mimeType: string, fileName: string): ProviderId[] {
  const kind = getMediaFileKind(mimeType, fileName);
  if (!kind) return [...providers];
  const extension = getFileExtension(fileName);
  return providers.filter((id) => {
    const provider = providerById.get(id);
    if (!provider?.fileKinds.includes(kind)) return false;
    // Either may match: systems report some formats under nonstandard MIME types (image/jpg) or none at all.
    return !provider.formats || Object.hasOwn(provider.formats, mimeType) || Object.values(provider.formats).some((extensions) => extensions.includes(extension));
  });
}
