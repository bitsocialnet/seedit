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
    // JPEG, PNG, WebP, GIF, MP4 and WebM; the API rejects other images and videos itself.
    fileKinds: ['image', 'video'],
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

/** The file's kind from its MIME type, or from its extension when the OS reports no MIME type or a generic one. */
export function getMediaFileKind(mimeType: string, fileName: string): MediaFileKind | null {
  if (mimeType === 'application/pdf') return 'pdf';
  const type = mimeType.split('/')[0];
  if (type === 'image' || type === 'video' || type === 'audio') return type;
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return FILE_KINDS.find((kind) => FILE_KIND_EXTENSIONS[kind].includes(extension)) ?? null;
}

/** Kinds of file at least one of the providers hosts, in a fixed display order. */
export function getProvidersFileKinds(providers: readonly ProviderId[]): MediaFileKind[] {
  return FILE_KINDS.filter((kind) => providers.some((provider) => providerById.get(provider)?.fileKinds.includes(kind)));
}

/** MIME type patterns for a file picker that offers the given kinds. */
export function getFileKindMimeTypes(kinds: readonly MediaFileKind[]): string[] {
  return kinds.map((kind) => FILE_KIND_MIME_TYPES[kind]);
}

/** The providers that host files of this kind. An unknown kind keeps them all and leaves the decision to each host. */
export function filterProvidersForFileKind(providers: readonly ProviderId[], kind: MediaFileKind | null): ProviderId[] {
  return kind ? providers.filter((provider) => providerById.get(provider)?.fileKinds.includes(kind)) : [...providers];
}
