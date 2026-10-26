import type { ProviderAttempt, ProviderId, UploadAttemptStage, UploadedMedia, UploadPhase } from './types';
import { stripMediaMetadata } from './strip-media-metadata';
import { uploadToCatbox } from './catbox';
import { uploadToForge } from './forge';

/** Attempt metadata inferred or parsed from plugin rejection. Used when plugins throw plain errors. */
function parseAttemptMetadata(errorMessage: string): {
  stage: UploadAttemptStage;
  matchedSelectors?: string[];
} {
  const msg = errorMessage.toLowerCase();
  if (msg.includes('blocked') || msg.includes('captcha') || msg.includes('challenge')) {
    return { stage: 'blocked' };
  }
  if (msg.includes('no file input') || msg.includes('file input')) {
    const tried = errorMessage.match(/Tried:\s*(.+)$/)?.[1];
    const selectors = tried
      ? tried
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    return { stage: 'file_input', matchedSelectors: selectors };
  }
  if (msg.includes('no submit') || msg.includes('submit button')) {
    const tried = errorMessage.match(/Tried:\s*(.+)$/)?.[1];
    const selectors = tried
      ? tried
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    return { stage: 'submit', matchedSelectors: selectors };
  }
  if (msg.includes('timeout') || msg.includes('upload timeout')) {
    return { stage: 'timeout' };
  }
  if (msg.includes('page load failed')) {
    return { stage: 'page_load' };
  }
  return { stage: 'unknown' };
}

async function fileToByteArray(file: File): Promise<number[]> {
  return Array.from(new Uint8Array(await file.arrayBuffer()));
}

/**
 * Uploads a file via a single provider. Forge and catbox use their web APIs;
 * imgur/imgbb use Electron automation when available.
 */
async function uploadViaProvider(provider: ProviderId, file: File, onPhaseChange?: (phase: UploadPhase) => void): Promise<UploadedMedia> {
  if (provider === 'forge') return uploadToForge(await stripMediaMetadata(file), { onChecking: () => onPhaseChange?.('checking') });
  if (provider === 'catbox') return { url: await uploadToCatbox(await stripMediaMetadata(file)) };
  if (provider === 'imgur' || provider === 'imgbb') {
    const electronApi = typeof window !== 'undefined' ? window.electronApi : undefined;
    if (electronApi?.automateUploadMedia) {
      // The preload resolves the path of a file the user picked or dropped, so the renderer never names a path.
      if (electronApi.isFileOnDisk?.(file)) {
        // Bytes for this route never transit JS; the Electron main process
        // strips metadata before automation (electron/strip-media-metadata.js).
        const { url } = await electronApi.automateUploadMedia({ provider, file });
        return { url };
      }

      const generatedFn = electronApi.automateUploadGeneratedMedia;
      if (!generatedFn) {
        throw new Error('File path unavailable and automateUploadGeneratedMedia is not available');
      }
      const cleanFile = await stripMediaMetadata(file);
      const { url } = await generatedFn({
        provider,
        fileName: cleanFile.name,
        mimeType: cleanFile.type || 'application/octet-stream',
        bytes: await fileToByteArray(cleanFile),
      });
      return { url };
    }
    throw new Error(`Provider ${provider} requires Electron (automateUploadMedia not available)`);
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

/** Rejection shape for errors that include structured metadata (forge adapter, future Electron/Android plugins) */
interface PluginRejectionMeta {
  stage?: UploadAttemptStage;
  matchedSelectors?: string[];
}

/**
 * Orchestrates a web or Electron upload, or an Android forge attempt: tries each provider in order, returns the first success.
 * Collects attempt errors with deterministic metadata (provider, stage, elapsedMs, matchedSelectors).
 * Throws with attempts if all fail. `onPhaseChange` hears 'uploading' as each provider
 * starts and 'checking' once a provider that reports it has received the file.
 */
export async function orchestrateUpload(file: File, providerOrder: ProviderId[], onPhaseChange?: (phase: UploadPhase) => void): Promise<UploadedMedia> {
  const attempts: ProviderAttempt[] = [];

  for (const provider of providerOrder) {
    const start = Date.now();
    onPhaseChange?.('uploading');
    try {
      return await uploadViaProvider(provider, file, onPhaseChange);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const elapsedMs = Date.now() - start;
      const meta = err && typeof err === 'object' && 'stage' in err ? (err as PluginRejectionMeta) : null;
      const parsed = parseAttemptMetadata(msg);
      attempts.push({
        provider,
        success: false,
        error: msg,
        stage: meta?.stage ?? parsed.stage,
        elapsedMs,
        matchedSelectors: meta?.matchedSelectors ?? parsed.matchedSelectors,
      });
    }
  }

  const err = new Error('All providers failed') as Error & { attempts: ProviderAttempt[] };
  err.attempts = attempts;
  throw err;
}
