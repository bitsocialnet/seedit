/**
 * Forge Images (forgeimg.net) endpoints and Turnstile sitekey.
 *
 * Production values are the defaults. Dev builds can point at a local Forge
 * Images backend with these Vite env vars:
 * - VITE_FORGE_IMAGES_API_ORIGIN: upload API origin, e.g. http://127.0.0.1:3917
 * - VITE_FORGE_IMAGES_MEDIA_ORIGIN: media serve origin, e.g. http://127.0.0.1:3917/dev/media
 * - VITE_FORGE_IMAGES_TURNSTILE_SITEKEY: Turnstile sitekey, e.g. Cloudflare's
 *   always-pass invisible test key 1x00000000000000000000BB
 */

/**
 * Public Turnstile sitekey of the Forge Images widget. Turnstile only issues tokens on the widget's
 * allowed hostnames, so each web host seedit is served from must be listed there; the desktop and
 * Android apps get their tokens on localhost.
 */
const TURNSTILE_SITEKEY = '0x4AAAAAAFScwbbNFZtx0XVP';

const readEnv = (value: string | undefined, fallback: string): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || fallback;
};

const readOrigin = (value: string | undefined, fallback: string): string => readEnv(value, fallback).replace(/\/+$/, '');

export const FORGE_IMAGES_API_ORIGIN = readOrigin(import.meta.env.VITE_FORGE_IMAGES_API_ORIGIN, 'https://img-api.bitsocialforge.com');

export const FORGE_IMAGES_MEDIA_ORIGIN = readOrigin(import.meta.env.VITE_FORGE_IMAGES_MEDIA_ORIGIN, 'https://forgeimg.net');

export const FORGE_IMAGES_TURNSTILE_SITEKEY = readEnv(import.meta.env.VITE_FORGE_IMAGES_TURNSTILE_SITEKEY, TURNSTILE_SITEKEY);
