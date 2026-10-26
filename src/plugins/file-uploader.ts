import { registerPlugin } from '@capacitor/core';
import type { ProviderAttempt, ProviderId } from '../lib/media-hosting';

interface PickMediaOptions {
  /** MIME type patterns the picker offers, e.g. image/*. */
  mimeTypes: string[];
}

interface PickedMedia {
  /** Opaque handle the plugin uploads the picked file by, so the web layer cannot make it upload an arbitrary native file. */
  id: string;
  fileName: string;
  mimeType: string;
  /** WebView-local URL that streams the picked file, for uploads made from the web layer (Forge Images). */
  webPath: string;
}

interface UploadPickedMediaOptions {
  id: string;
  providerOrder: ProviderId[];
}

interface UploadGeneratedMediaOptions {
  providerOrder: ProviderId[];
  fileName: string;
  mimeType: string;
  base64: string;
}

interface UploadMediaResult {
  url: string;
  fileName: string;
  provider: ProviderId;
  attempts?: ProviderAttempt[];
}

/** Android-only native uploader; desktop and web upload from the renderer and the Electron main process. */
interface FileUploaderPlugin {
  pickMedia(options: PickMediaOptions): Promise<PickedMedia>;
  uploadPickedMedia(options: UploadPickedMediaOptions): Promise<UploadMediaResult>;
  uploadGeneratedMedia(options: UploadGeneratedMediaOptions): Promise<UploadMediaResult>;
}

const FileUploader = registerPlugin<FileUploaderPlugin>('FileUploader');

export default FileUploader;
