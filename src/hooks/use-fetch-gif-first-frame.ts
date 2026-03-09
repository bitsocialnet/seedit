import { useEffect, useState } from 'react';
import { decompressFrames, parseGIF } from 'gifuct-js';
import localForageLru from '@bitsocialnet/bitsocial-react-hooks/dist/lib/localforage-lru/index.js';

const gifFrameDb = localForageLru.createInstance({ name: 'seeditGifFrames', size: 500 });

const isChromium = () => {
  const ua = navigator.userAgent;
  return (ua.includes('Chrome') || ua.includes('Chromium') || ua.includes('Edge')) && !ua.includes('Firefox');
};

const getCachedGifFrame = async (url: string): Promise<string | null> => {
  return await gifFrameDb.getItem(url);
};

const setCachedGifFrame = async (url: string, frameUrl: string): Promise<void> => {
  await gifFrameDb.setItem(url, frameUrl);
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

const useFetchGifFirstFrame = (url: string | undefined) => {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!url) {
      setFrameUrl(null);
      setIsLoading(false);
      return;
    }

    // Skip frame extraction on Chromium browsers due to strict CORS policies
    if (isChromium()) {
      console.log('Skipping GIF frame extraction on Chromium browser due to CORS restrictions');
      setFrameUrl(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setFrameUrl(null);

    const fetchFrame = async () => {
      try {
        // Check cache first
        const cachedFrame = await getCachedGifFrame(url);
        if (cachedFrame && isActive) {
          try {
            const response = await fetch(cachedFrame);
            if (response.ok) {
              setFrameUrl(cachedFrame);
              setIsLoading(false);
              return;
            }
          } catch {
            // Cache entry is invalid, continue with fresh extraction
          }
        }

        // For Chrome CORS compatibility, try the simple image approach first
        if (typeof url === 'string') {
          try {
            console.log('Trying simple image approach first...');
            const objectUrl = await createStaticImageFromGif(url);

            if (isActive) {
              setFrameUrl(objectUrl);
              setIsLoading(false);
              await setCachedGifFrame(url, objectUrl);
            }
            return; // Success with simple approach
          } catch (simpleError) {
            console.log('Simple image approach failed, trying advanced extraction:', simpleError);
          }
        }

        // Fallback to advanced frame extraction (gifuct-js)
        const buffer = typeof url === 'string' ? await fetchImage(url) : await readImage(url as File);
        const blob = await extractFirstFrame(buffer);
        const objectUrl = URL.createObjectURL(blob);

        if (isActive) {
          setFrameUrl(objectUrl);
          setIsLoading(false);
          await setCachedGifFrame(url, objectUrl);
        }
      } catch (error) {
        console.error('Failed to load GIF frame:', error);

        // Final fallback attempts (keep the existing fallback logic)
        if (typeof url === 'string' && error instanceof Error && error.message.includes('XMLHttpRequest')) {
          try {
            console.log('Trying fallback fetch method...');
            const buffer = await fetchImageWithFetch(url);
            const blob = await extractFirstFrame(buffer);
            const objectUrl = URL.createObjectURL(blob);

            if (isActive) {
              setFrameUrl(objectUrl);
              setIsLoading(false);
              await setCachedGifFrame(url, objectUrl);
            }
            return; // Success with fallback
          } catch (fallbackError) {
            console.error('All methods failed:', fallbackError);
          }
        }

        if (isActive) {
          setFrameUrl(null);
          setIsLoading(false);
        }
      }
    };

    fetchFrame();

    return () => {
      isActive = false;
    };
  }, [url]);

  return { frameUrl, isLoading };
};

export default useFetchGifFirstFrame;
