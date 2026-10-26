// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadToCatbox } from './catbox';

const respond = (body: string, status = 200) => vi.fn(async () => ({ ok: status >= 200 && status < 300, status, statusText: '', text: async () => body }));

describe('uploadToCatbox', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the file and returns the catbox file URL', async () => {
    const fetchMock = respond('https://files.catbox.moe/abc.pdf\n');
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadToCatbox(new File(['%PDF'], 'paper.pdf', { type: 'application/pdf' }))).resolves.toBe('https://files.catbox.moe/abc.pdf');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://catbox.moe/user/api.php');
    expect((init.body as FormData).get('reqtype')).toBe('fileupload');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects a response that is not a catbox file URL, since it would be posted publicly', async () => {
    vi.stubGlobal('fetch', respond('<html>error</html>'));

    await expect(uploadToCatbox(new File(['x'], 'x.png'))).rejects.toThrow('unexpected response');
  });

  it('rejects a non-2xx answer', async () => {
    vi.stubGlobal('fetch', respond('', 412));

    await expect(uploadToCatbox(new File(['x'], 'x.png'))).rejects.toThrow('Upload failed: 412');
  });
});
