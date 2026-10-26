import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FileUploader from '../plugins/file-uploader';
import {
  MEDIA_HOSTING_PROVIDERS,
  ensureProviderAvailability,
  filterProvidersForFile,
  formatAggregatedError,
  formatPreferredModeError,
  getEnabledProviders,
  getMediaHostingRuntime,
  getProviderLabel,
  getProviderOrder,
  getProvidersAccept,
  getProvidersFileKinds,
  getRuntimeProviders,
  orchestrateUpload,
  stripMediaMetadata,
  type AttachedMedia,
  type MediaHostingRuntime,
  type ProviderAttempt,
  type ProviderId,
  type UploadAttemptStage,
  type UploadMode,
  type UploadPhase,
} from '../lib/media-hosting';
import useMediaHostingStore from '../stores/use-media-hosting-store';

/** Maps Android plugin stage strings to UploadAttemptStage (avoids unsafe cast). Includes pass-through for valid stages. */
const ANDROID_STAGE_MAP: Record<string, UploadAttemptStage> = {
  input_not_found: 'file_input',
  chooser_not_triggered: 'file_input',
  upload_timed_out: 'timeout',
  blocked_detected: 'blocked',
  provider_error: 'provider_error',
  no_recipe: 'unknown',
  page_loaded: 'page_load',
  blocked: 'blocked',
  file_input: 'file_input',
  submit: 'submit',
  timeout: 'timeout',
  page_load: 'page_load',
  unknown: 'unknown',
};

const FILE_SELECTION_CANCELLED_ERROR = 'File selection cancelled';

/** Derived from the registry so a new provider's Android attempts are never dropped from error aggregation. */
const VALID_PROVIDERS: ReadonlySet<string> = new Set(MEDIA_HOSTING_PROVIDERS.map((provider) => provider.id));

/** Raw attempt shape from Android plugin rejection payload */
interface RawAttempt {
  provider?: unknown;
  success?: unknown;
  error?: unknown;
  stage?: unknown;
  elapsedMs?: unknown;
  matchedSelectors?: unknown;
}

/**
 * Normalizes Android Capacitor rejection payload. The plugin may reject with
 * `{ message, code, data: { attempts: [...] } }` where attempts contain
 * provider, error, stage, elapsedMs, matchedSelectors. We extract and attach
 * attempts to the error so formatAggregatedError can surface them.
 */
function normalizeAndroidRejection(error: unknown): Error & { attempts?: ProviderAttempt[] } {
  const err = error as Error & { data?: { attempts?: unknown[] }; attempts?: ProviderAttempt[] };
  if (err?.attempts?.length) return err;
  const raw = err?.data?.attempts;
  if (!Array.isArray(raw) || raw.length === 0) return err;

  const attempts: ProviderAttempt[] = raw
    .map((a: unknown): ProviderAttempt | null => {
      const item = a as RawAttempt;
      const provider = item?.provider;
      if (typeof provider !== 'string' || !VALID_PROVIDERS.has(provider)) return null;
      let matchedSelectors: string[] | undefined;
      if (Array.isArray(item?.matchedSelectors)) {
        matchedSelectors = (item.matchedSelectors as unknown[]).filter((s): s is string => typeof s === 'string');
      } else if (typeof item?.matchedSelectors === 'string' && item.matchedSelectors.trim()) {
        matchedSelectors = item.matchedSelectors
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
      return {
        provider: provider as ProviderId,
        success: Boolean(item?.success),
        error: typeof item?.error === 'string' ? item.error : undefined,
        stage: typeof item?.stage === 'string' && item.stage ? (ANDROID_STAGE_MAP[item.stage] ?? 'unknown') : undefined,
        elapsedMs: typeof item?.elapsedMs === 'number' ? item.elapsedMs : undefined,
        matchedSelectors: matchedSelectors?.length ? matchedSelectors : undefined,
      };
    })
    .filter((a): a is ProviderAttempt => a !== null);

  if (attempts.length > 0) {
    err.attempts = attempts;
  }
  return err;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const marker = result.indexOf(',');
      resolve(marker >= 0 ? result.slice(marker + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/** Groups the order for Android: forge on its own, each run of other providers as one plugin call. */
function splitAndroidProviderOrder(order: ProviderId[]): ProviderId[][] {
  const batches: ProviderId[][] = [];
  for (const provider of order) {
    const lastBatch = batches[batches.length - 1];
    if (provider !== 'forge' && lastBatch && lastBatch[0] !== 'forge') {
      lastBatch.push(provider);
    } else {
      batches.push([provider]);
    }
  }
  return batches;
}

/** The media as a File for a web-layer upload. A picked file streams from Capacitor's local server, not across the bridge as base64. */
async function getAttachedFile(media: AttachedMedia): Promise<File> {
  if (media.kind === 'file') return media.file;
  const response = await fetch(media.webPath);
  if (!response.ok) throw new Error('Picked file is no longer available. Choose it again.');
  const blob = await response.blob();
  return new File([blob], media.name, { type: media.mimeType || blob.type });
}

async function uploadViaAndroidPlugin(media: AttachedMedia, providerOrder: ProviderId[]): Promise<string> {
  if (media.kind === 'picked') {
    // The plugin strips metadata before upload (android MediaMetadataStripper).
    return (await FileUploader.uploadPickedMedia({ id: media.id, providerOrder })).url;
  }
  const cleanFile = await stripMediaMetadata(media.file);
  const result = await FileUploader.uploadGeneratedMedia({
    providerOrder,
    fileName: cleanFile.name,
    mimeType: cleanFile.type || 'application/octet-stream',
    base64: await readFileAsBase64(cleanFile),
  });
  return result.url;
}

/** The attempts behind a failed upload, or one per provider when the failure did not report any. */
function getFailedAttempts(error: unknown, providers: ProviderId[]): ProviderAttempt[] {
  const { attempts } = normalizeAndroidRejection(error);
  if (attempts?.length) return attempts;
  const message = error instanceof Error ? error.message : String(error);
  return providers.map((provider) => ({ provider, success: false, error: message }));
}

interface UploadedAttachment {
  url: string;
  awaitingReview: boolean;
}

/**
 * Android uploads to forge from the WebView, which can run its Turnstile check and which forge
 * allows by CORS, and to the other providers through the native plugin, trying them in order.
 * When all fail, their attempts are merged into one error.
 */
async function uploadOnAndroid(media: AttachedMedia, order: ProviderId[], onPhaseChange: (phase: UploadPhase) => void): Promise<UploadedAttachment> {
  const batches = splitAndroidProviderOrder(order);
  const attempts: ProviderAttempt[] = [];
  for (const batch of batches) {
    onPhaseChange('uploading');
    try {
      if (batch[0] === 'forge') {
        const uploaded = await orchestrateUpload(await getAttachedFile(media), batch, onPhaseChange);
        return { url: uploaded.url, awaitingReview: uploaded.awaitingReview === true };
      }
      return { url: await uploadViaAndroidPlugin(media, batch), awaitingReview: false };
    } catch (error) {
      // A lone batch keeps its own error.
      if (batches.length === 1) throw error;
      attempts.push(...getFailedAttempts(error, batch));
    }
  }
  throw Object.assign(new Error('All providers failed'), { attempts });
}

interface UploadSettings {
  mode: UploadMode;
  preferredProvider: ProviderId;
  runtime: MediaHostingRuntime;
}

/** The providers to try for this file, in order. */
async function getAvailableProviderOrder(media: AttachedMedia, { mode, preferredProvider, runtime }: UploadSettings): Promise<ProviderId[]> {
  if (mode === 'none') {
    throw new Error('Uploads are turned off in the media hosting settings');
  }
  const supportedOrder = filterProvidersForFile(getProviderOrder({ mode, preferredProvider, runtime }), media.mimeType, media.name);
  if (supportedOrder.length === 0) {
    const enabled = getEnabledProviders({ mode, preferredProvider, runtime });
    throw new Error(`${enabled.map(getProviderLabel).join(', ')} cannot host this type of file`);
  }

  // With one provider there is nothing to fall back to, and a probe that failed on a slow network
  // would block uploads until its result expires, so just try it.
  if (supportedOrder.length === 1) return supportedOrder;
  const availability = await ensureProviderAvailability(runtime);
  const order = filterProvidersForFile(getProviderOrder({ mode, preferredProvider, runtime, availability }), media.mimeType, media.name);
  // Probes are a hint for skipping unreachable providers; when none passed, try them all anyway.
  return order.length > 0 ? order : supportedOrder;
}

/** Uploads through the providers the settings enable for this file. Throws when every one failed. */
async function uploadThroughProviders(media: AttachedMedia, settings: UploadSettings, onPhaseChange: (phase: UploadPhase) => void): Promise<UploadedAttachment> {
  const order = await getAvailableProviderOrder(media, settings);
  let uploaded: UploadedAttachment;
  if (media.kind === 'picked' || settings.runtime === 'android') {
    uploaded = await uploadOnAndroid(media, order, onPhaseChange);
  } else {
    const result = await orchestrateUpload(media.file, order, onPhaseChange);
    uploaded = { url: result.url, awaitingReview: result.awaitingReview === true };
  }
  if (!uploaded.url) {
    throw new Error('The upload returned no link');
  }
  return uploaded;
}

/**
 * Uploads a chosen file through the media hosting providers set in the preferences
 * (Forge Images by default). `fileKinds` are the kinds of file those providers host, and
 * `accept` the formats (MIME type to extensions) the pickers and drop zone should offer.
 */
export function useMediaUpload() {
  const { t } = useTranslation();
  const uploadMode = useMediaHostingStore((s) => s.uploadMode);
  const preferredProvider = useMediaHostingStore((s) => s.preferredProvider);
  /** Null while no upload runs. */
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | null>(null);
  const runtime = getMediaHostingRuntime();
  const enabledProviders = getEnabledProviders({ mode: uploadMode, preferredProvider, runtime });
  const fileKinds = getProvidersFileKinds(enabledProviders);
  const accept = getProvidersAccept(enabledProviders);
  // An upload can outlive its form (the post was published, the user left, or typed a link instead),
  // so its late result and alerts are dropped rather than written into the next draft.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const alertUploadError = (error: unknown, media: AttachedMedia) => {
    const { attempts } = normalizeAndroidRejection(error);
    if (attempts && attempts.length > 1) {
      window.alert(formatAggregatedError(attempts, t));
      return;
    }
    // A single attempt reads as a plain error; the orchestrator wraps even one provider's failure.
    const errorMessage = attempts?.[0]?.error ?? (error instanceof Error ? error.message : String(error));
    // Suggest switching only when another provider can host this file (only Catbox takes audio and PDF).
    const enabled = getEnabledProviders({ mode: uploadMode, preferredProvider, runtime });
    const otherProviders = getRuntimeProviders(runtime)
      .map((provider) => provider.id)
      .filter((provider) => !enabled.includes(provider));
    if (uploadMode === 'preferred' && filterProvidersForFile(otherProviders, media.mimeType, media.name).length > 0) {
      window.alert(formatPreferredModeError(errorMessage, t));
    } else {
      window.alert(`${t('upload_failed')}: ${errorMessage}`);
    }
  };

  /** Opens the Android picker, offering only the kinds the enabled providers host. Returns null when cancelled. */
  const pickAndroidMedia = async (): Promise<AttachedMedia | null> => {
    try {
      const picked = await FileUploader.pickMedia({ mimeTypes: Object.keys(accept) });
      return { kind: 'picked', id: picked.id, name: picked.fileName, mimeType: picked.mimeType, webPath: picked.webPath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage !== FILE_SELECTION_CANCELLED_ERROR) {
        window.alert(`${t('upload_failed')}: ${errorMessage}`);
      }
      return null;
    }
  };

  /** Uploads the media and returns its link, or alerts and returns null when the upload fails. */
  const uploadMedia = async (media: AttachedMedia): Promise<string | null> => {
    setUploadPhase('uploading');
    const uploaded = await uploadThroughProviders(media, { mode: uploadMode, preferredProvider, runtime }, setUploadPhase).catch((error: unknown) => {
      if (mountedRef.current) alertUploadError(error, media);
      return null;
    });
    setUploadPhase(null);
    if (!uploaded || !mountedRef.current) return null;
    // The link is used either way: it starts working once the host approves it.
    if (uploaded.awaitingReview) window.alert(t('upload_awaiting_review'));
    return uploaded.url;
  };

  return { uploadPhase, fileKinds, accept, pickAndroidMedia, uploadMedia };
}
