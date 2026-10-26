const CATBOX_API = 'https://catbox.moe/user/api.php';
/** Covers a large video, audio file or PDF on a slow uplink; a hung request still fails. */
const CATBOX_UPLOAD_TIMEOUT_MS = 300_000;

/**
 * Upload a file to catbox.moe.
 * @param file - The file to upload
 * @returns The URL of the uploaded file
 * @throws Error when the response is not ok, is not a catbox file URL, or times out
 */
export async function uploadToCatbox(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('reqtype', 'fileupload');
  formData.append('fileToUpload', file);

  const response = await fetch(CATBOX_API, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(CATBOX_UPLOAD_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  // The URL is written into a public post, so it must point at catbox's file host.
  const text = (await response.text()).trim();
  if (!text.startsWith('https://files.catbox.moe/')) {
    throw new Error(`Upload failed: unexpected response ${JSON.stringify(text.slice(0, 100))}`);
  }
  return text;
}
