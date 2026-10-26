import { FORGE_IMAGES_API_ORIGIN, FORGE_IMAGES_MEDIA_ORIGIN, FORGE_IMAGES_TURNSTILE_SITEKEY } from './forge-images-config';
import type { UploadAttemptStage, UploadedMedia } from './types';
import { getTurnstileToken } from './turnstile';
import { postFormData } from './upload-request';

/** Covers a 50 MiB video (the largest anonymous cap) on a slow uplink; a hung request still fails. */
const FORGE_UPLOAD_TIMEOUT_MS = 300_000;
/** Longest wait for a pending (in moderation) image to start serving before the upload is reported as not ready. */
const PENDING_SERVE_WAIT_MS = 60_000;
/** Videos are moderated frame by frame, which is slower; past this wait the link returns flagged as awaiting review. */
const PENDING_VIDEO_SERVE_WAIT_MS = 120_000;
const PENDING_POLL_MAX_INTERVAL_MS = 8_000;
const SERVE_PROBE_TIMEOUT_MS = 10_000;

/** Upload failure carrying the attempt stage that the upload orchestrator records. */
export class ForgeUploadError extends Error {
  readonly stage: UploadAttemptStage;

  constructor(message: string, stage: UploadAttemptStage) {
    super(message);
    this.name = 'ForgeUploadError';
    this.stage = stage;
  }
}

interface ForgeUploadOptions {
  /** Returns a fresh single-use Turnstile token. Defaults to the Turnstile widget for this runtime. */
  getToken?: () => Promise<string>;
  timeoutMs?: number;
  pendingServeWaitMs?: number;
  pendingVideoServeWaitMs?: number;
  /**
   * Called once the file has been sent. From then on the wait is Forge's automated
   * checks (metadata strip, blocklist, moderation), not the transfer.
   */
  onChecking?: () => void;
}

interface ForgeUploadResponse {
  url?: unknown;
  status?: unknown;
  mime?: unknown;
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Reads `error.message` from the API's `{ error: { code, message } }` body. */
function getApiErrorMessage(body: unknown): string | undefined {
  const error = (body as { error?: { message?: unknown } } | null)?.error;
  return typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : undefined;
}

/** The URL is written into a permanent public post, so it must point at the Forge media origin. */
function getUploadedUrl(body: ForgeUploadResponse | null): string {
  const url = body?.url;
  if (typeof url === 'string' && url.startsWith(`${FORGE_IMAGES_MEDIA_ORIGIN}/`)) return url;
  throw new ForgeUploadError('Upload failed: the response did not include a valid URL', 'provider_error');
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Loads the URL the way the post form's media check does (an <img>), so no CORS is involved. */
function canLoadImage(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const settle = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      image.onload = null;
      image.onerror = null;
      resolve(loaded);
    };
    const timeoutId = setTimeout(() => {
      settle(false);
      // Stop the abandoned download so slow polls of a large GIF do not overlap.
      image.src = '';
    }, timeoutMs);
    image.onload = () => settle(true);
    image.onerror = () => settle(false);
    image.referrerPolicy = 'no-referrer';
    image.src = url;
  });
}

/** Loads only the video's metadata, as a post's <video> embed would start to, so no CORS is involved. */
function canLoadVideo(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let settled = false;
    const settle = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      video.onloadedmetadata = null;
      video.onerror = null;
      // Drop the source so the abandoned element stops downloading and releases its decoder.
      video.removeAttribute('src');
      video.load();
      resolve(loaded);
    };
    const timeoutId = setTimeout(() => settle(false), timeoutMs);
    video.onloadedmetadata = () => settle(true);
    video.onerror = () => settle(false);
    video.preload = 'metadata';
    video.muted = true;
    video.src = url;
  });
}

/**
 * Asks the media origin whether the video serves instead of decoding it, so a
 * codec this browser cannot play (HEVC in Firefox) still counts as served once
 * it is live. The HEAD request needs CORS on the media origin; when it fails
 * outright (network or CORS error), this attempt falls back to a metadata load.
 */
async function isVideoServing(url: string, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, { method: 'HEAD', cache: 'no-store', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal });
  } catch {
    // A timed-out request used this attempt's budget; the next attempt retries.
    if (controller.signal.aborted) return false;
    return canLoadVideo(url, timeoutMs - (Date.now() - startedAt));
  } finally {
    clearTimeout(timeoutId);
  }
  return response.ok;
}

/**
 * A new upload 404s until its moderation verdict lands (seconds for images,
 * longer for videos; forge-images ARCHITECTURE.md §2), so poll with backoff,
 * bounded, until the media serves.
 */
async function waitUntilServes(url: string, maxWaitMs: number, canLoad: (url: string, timeoutMs: number) => Promise<boolean>): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  let delay = 1_000;
  while (Date.now() < deadline) {
    await sleep(Math.min(delay, deadline - Date.now()));
    // Keep the last probe from running far past the deadline.
    if (await canLoad(url, Math.min(SERVE_PROBE_TIMEOUT_MS, Math.max(deadline - Date.now(), 1_000)))) return true;
    delay = Math.min(delay * 2, PENDING_POLL_MAX_INTERVAL_MS);
  }
  return false;
}

/**
 * Electron's packaged renderer loads from file://, which has no hostname Turnstile
 * accepts, so the main process runs the widget in its own window there.
 */
function getForgeTurnstileToken(): Promise<string> {
  const getElectronToken = window.electronApi?.getForgeTurnstileToken;
  return getElectronToken ? getElectronToken(FORGE_IMAGES_TURNSTILE_SITEKEY) : getTurnstileToken(FORGE_IMAGES_TURNSTILE_SITEKEY);
}

/**
 * Upload a file to Forge Images (API contract: forge-images docs/ARCHITECTURE.md §4).
 * Returns the media URL for `live` uploads, and for `pending` images once they
 * pass moderation and start serving (up to a minute). An image still in review
 * after that fails instead: the post form loads image links once when inserted,
 * so its URL would stay marked broken even after it goes live, while a later
 * retry dedups to `live` at once. A pending video gets up to two minutes to
 * start serving; the post form does not load-check video links, so one still in
 * review returns flagged `awaitingReview` rather than failing. Other pending
 * files (new SWFs) wait for human review that can take hours, so their URL
 * returns at once flagged `awaitingReview`; it serves once approved.
 * @throws ForgeUploadError with stage 'blocked' (Turnstile failed, or 403),
 * 'provider_error' (other API errors), 'timeout', or 'unknown' (network failure)
 */
export async function uploadToForge(file: File, options: ForgeUploadOptions = {}): Promise<UploadedMedia> {
  const {
    getToken = getForgeTurnstileToken,
    timeoutMs = FORGE_UPLOAD_TIMEOUT_MS,
    pendingServeWaitMs = PENDING_SERVE_WAIT_MS,
    pendingVideoServeWaitMs = PENDING_VIDEO_SERVE_WAIT_MS,
    onChecking,
  } = options;

  let token: string;
  try {
    token = await getToken();
  } catch (error) {
    throw new ForgeUploadError(`Turnstile check failed: ${getErrorMessage(error)}`, 'blocked');
  }

  const formData = new FormData();
  // Text fields go before the file part so the API can reject a bad token
  // without reading the whole body. No custom headers; the API answers the
  // preflight that reporting the sent body can trigger.
  formData.append('turnstile', token);
  formData.append('file', file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const timeoutError = () => new ForgeUploadError(`Upload timed out after ${Math.round(timeoutMs / 1000)}s`, 'timeout');

  let body: ForgeUploadResponse | null;
  try {
    const response = await postFormData(`${FORGE_IMAGES_API_ORIGIN}/api/upload`, formData, { signal: controller.signal, onBodySent: onChecking });
    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => null);
      const detail = getApiErrorMessage(errorBody) ?? `Upload failed: ${response.status} ${response.statusText}`.trim();
      // 403 is turnstile_failed or banned: an abuse-control block, not a bad file.
      throw new ForgeUploadError(detail, response.status === 403 ? 'blocked' : 'provider_error');
    }
    body = (await response.json().catch(() => null)) as ForgeUploadResponse | null;
    if (controller.signal.aborted) throw timeoutError();
  } catch (error) {
    if (error instanceof ForgeUploadError) throw error;
    if (controller.signal.aborted) throw timeoutError();
    throw new ForgeUploadError(`Network error: ${getErrorMessage(error)}`, 'unknown');
  } finally {
    clearTimeout(timeoutId);
  }

  const url = getUploadedUrl(body);
  if (body?.status !== 'pending') return { url };
  const mime = typeof body.mime === 'string' ? body.mime : '';
  if (mime.startsWith('image/') && pendingServeWaitMs > 0) {
    if (!(await waitUntilServes(url, pendingServeWaitMs, canLoadImage))) {
      throw new ForgeUploadError('The image was uploaded but is still being reviewed. Try again in a minute.', 'provider_error');
    }
    return { url };
  }
  if (mime.startsWith('video/') && pendingVideoServeWaitMs > 0 && (await waitUntilServes(url, pendingVideoServeWaitMs, isVideoServing))) {
    return { url };
  }
  return { url, awaitingReview: true };
}
