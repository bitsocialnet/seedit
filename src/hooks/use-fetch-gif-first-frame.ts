import { useEffect, useState } from 'react';
import { decompressFrames, parseGIF } from 'gifuct-js';

const isChromium = () => {
  const ua = navigator.userAgent;
  return (ua.includes('Chrome') || ua.includes('Chromium') || ua.includes('Edge')) && !ua.includes('Firefox');
};

export const fetchImage = (url: string): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';

    // Add error logging to understand what's happening
    request.onloadend = () => {
      console.log('XMLHttpRequest completed:', {
        url,
        status: request.status,
        statusText: request.statusText,
        responseType: request.responseType,
        response: request.response,
        readyState: request.readyState,
      });

      if (request.response !== undefined && (request.status === 200 || request.status === 304)) {
        resolve(request.response);
      } else {
        reject(new Error(`XMLHttpRequest failed: ${request.status} ${request.statusText} for URL: ${url}`));
      }
    };

    request.onerror = () => {
      console.error('XMLHttpRequest error:', {
        url,
        status: request.status,
        statusText: request.statusText,
        readyState: request.readyState,
      });
      reject(new Error(`XMLHttpRequest network error for URL: ${url}`));
    };

    request.ontimeout = () => {
      console.error('XMLHttpRequest timeout:', { url });
      reject(new Error(`XMLHttpRequest timeout for URL: ${url}`));
    };

    // Set timeout to prevent hanging
    request.timeout = 30000; // 30 seconds

    // Try to handle CORS
    try {
      request.send();
    } catch (error) {
      console.error('XMLHttpRequest send error:', error);
      reject(new Error(`XMLHttpRequest send failed: ${error}`));
    }
  });
};

// Fallback fetch method for when XMLHttpRequest fails
export const fetchImageWithFetch = async (url: string): Promise<ArrayBuffer> => {
  try {
    console.log('Trying fetch method for:', url);
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'default',
    });

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log('Fetch successful for:', url);
    return arrayBuffer;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

export const readImage = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(file);
  });
};

const extractFirstFrame = async (buffer: ArrayBuffer): Promise<Blob> => {
  try {
    // Parse the GIF using gifuct-js
    const gif = parseGIF(buffer);
    const frames = decompressFrames(gif, true);

    if (frames.length === 0) {
      throw new Error('No frames found in GIF');
    }

    // Get the first frame
    const firstFrame = frames[0];
    const { width, height } = firstFrame.dims;

    // Create canvas and draw the frame
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    // Create ImageData from the frame data
    const imageData = new ImageData(new Uint8ClampedArray(firstFrame.patch), width, height);

    // Clear canvas and put the image data
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(imageData, 0, 0);

    // Convert to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        'image/png',
        1.0,
      );
    });
  } catch (error) {
    throw new Error(`Failed to extract first frame: ${error}`);
  }
};

// CORS-bypass method using image element
export const fetchImageViaCORSProxy = async (url: string): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Create a canvas to get the image data
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Cannot get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);

        // Convert canvas to blob and then to ArrayBuffer
        canvas.toBlob(
          async (blob) => {
            if (blob) {
              try {
                const arrayBuffer = await blob.arrayBuffer();
                resolve(arrayBuffer);
              } catch (error) {
                reject(new Error(`Failed to convert blob to ArrayBuffer: ${error}`));
              }
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          },
          'image/gif',
          1.0,
        );
      } catch (error) {
        reject(new Error(`Canvas operation failed: ${error}`));
      }
    };

    img.onerror = () => {
      reject(new Error(`Image load failed for URL: ${url}`));
    };

    // Try different approaches for CORS
    try {
      img.src = url;
    } catch (error) {
      reject(new Error(`Failed to set image src: ${error}`));
    }
  });
};

// Simple proxy approach - just use the image directly without trying to extract frames
export const createStaticImageFromGif = async (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Cannot get canvas context'));
          return;
        }

        // Clear and draw the image (this should get the first frame in most cases)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const objectUrl = URL.createObjectURL(blob);
              resolve(objectUrl);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          },
          'image/png',
          1.0,
        );
      } catch (error) {
        reject(new Error(`Canvas operation failed: ${error}`));
      }
    };

    img.onerror = () => {
      reject(new Error(`Image load failed for URL: ${url}`));
    };

    // Don't set crossOrigin for this approach to avoid CORS issues
    img.src = url;
  });
};

const extractGifFirstFrame = async (url: string): Promise<string | null> => {
  try {
    // For Chrome CORS compatibility, try the simple image approach first
    try {
      console.log('Trying simple image approach first...');
      return await createStaticImageFromGif(url);
    } catch (simpleError) {
      console.log('Simple image approach failed, trying advanced extraction:', simpleError);
    }

    // Fallback to advanced frame extraction (gifuct-js)
    const buffer = await fetchImage(url);
    const blob = await extractFirstFrame(buffer);
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Failed to load GIF frame:', error);

    // Final fallback attempts (keep the existing fallback logic)
    if (error instanceof Error && error.message.includes('XMLHttpRequest')) {
      try {
        console.log('Trying fallback fetch method...');
        const buffer = await fetchImageWithFetch(url);
        const blob = await extractFirstFrame(buffer);
        return URL.createObjectURL(blob);
      } catch (fallbackError) {
        console.error('All methods failed:', fallbackError);
      }
    }
    return null;
  }
};

// Frames are object URLs, which die with the page, so they are cached for this session only. Every thumbnail of a gif
// shares one extraction, including one that unmounts before it finishes, and the oldest frame is released past the limit.
const MAX_CACHED_GIF_FRAMES = 500;
const gifFrames = new Map<string, Promise<string | null>>();

const getGifFirstFrame = (url: string): Promise<string | null> => {
  const cachedFrame = gifFrames.get(url);
  if (cachedFrame) {
    gifFrames.delete(url);
    gifFrames.set(url, cachedFrame);
    return cachedFrame;
  }

  const frame = extractGifFirstFrame(url);
  gifFrames.set(url, frame);
  // a failed extraction is tried again on the next mount
  frame.then((frameUrl) => {
    if (!frameUrl && gifFrames.get(url) === frame) gifFrames.delete(url);
  });

  if (gifFrames.size > MAX_CACHED_GIF_FRAMES) {
    const [oldestUrl, oldestFrame] = gifFrames.entries().next().value!;
    gifFrames.delete(oldestUrl);
    oldestFrame.then((frameUrl) => {
      if (frameUrl) URL.revokeObjectURL(frameUrl);
    });
  }
  return frame;
};

const useFetchGifFirstFrame = (url: string | undefined) => {
  // keyed by url so a result from a previous url is never shown as the current one
  const [frameResult, setFrameResult] = useState<{ url: string; frameUrl: string | null } | null>(null);
  // every url change looks the frame up again, so a url that comes back never reuses its old result
  const [prevUrl, setPrevUrl] = useState(url);
  if (url !== prevUrl) {
    setPrevUrl(url);
    setFrameResult(null);
  }
  // Skip frame extraction on Chromium browsers due to strict CORS policies
  const shouldExtract = Boolean(url) && !isChromium();

  useEffect(() => {
    if (!url) return;

    if (!shouldExtract) {
      console.log('Skipping GIF frame extraction on Chromium browser due to CORS restrictions');
      return;
    }

    let isActive = true;
    getGifFirstFrame(url).then((frameUrl) => {
      if (isActive) {
        setFrameResult({ url, frameUrl });
      }
    });

    return () => {
      isActive = false;
    };
  }, [url, shouldExtract]);

  const currentResult = shouldExtract && frameResult?.url === url ? frameResult : null;
  return { frameUrl: currentResult?.frameUrl ?? null, isLoading: shouldExtract && !currentResult };
};

export default useFetchGifFirstFrame;
