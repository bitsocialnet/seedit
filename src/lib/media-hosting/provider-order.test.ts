// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { getEnabledProviders, getRandomOrder, getProviderOrder, resolveUploadSettings } from './provider-order';
import { filterProvidersForFile, getMediaFileKind, getProvidersAccept, getProvidersFileKinds } from './providers';

describe('provider-order', () => {
  describe('getRandomOrder', () => {
    it('returns shuffled copy (Fisher-Yates) with default rng', () => {
      const providers = ['catbox', 'imgur', 'imgbb'] as const;
      const result = getRandomOrder(providers);
      expect(result).toHaveLength(3);
      expect([...result].sort()).toEqual(['catbox', 'imgbb', 'imgur']);
      expect(result).not.toBe(providers);
    });

    it('uses provided rng for deterministic shuffle', () => {
      const providers = ['catbox', 'imgur', 'imgbb'] as const;
      const rng = vi.fn().mockReturnValue(0.5);
      const result = getRandomOrder(providers, rng);
      expect(rng).toHaveBeenCalled();
      expect(result).toHaveLength(3);
    });

    it('handles empty array', () => {
      expect(getRandomOrder([])).toEqual([]);
    });

    it('handles single element', () => {
      expect(getRandomOrder(['catbox'])).toEqual(['catbox']);
    });
  });

  describe('resolveUploadSettings', () => {
    it('maps Random to Preferred when the runtime has a single provider', () => {
      expect(resolveUploadSettings({ mode: 'random', preferredProvider: 'catbox', runtime: 'web' })).toEqual({ mode: 'preferred', preferredProvider: 'forge' });
    });

    it('keeps Random when the runtime has several providers', () => {
      expect(resolveUploadSettings({ mode: 'random', preferredProvider: 'imgur', runtime: 'electron' })).toEqual({ mode: 'random', preferredProvider: 'imgur' });
    });

    it('keeps None', () => {
      expect(resolveUploadSettings({ mode: 'none', preferredProvider: 'forge', runtime: 'web' })).toEqual({ mode: 'none', preferredProvider: 'forge' });
    });
  });

  describe('getProviderOrder', () => {
    it('returns empty array when mode is none', () => {
      expect(getProviderOrder({ mode: 'none', preferredProvider: 'catbox', runtime: 'electron' })).toEqual([]);
    });

    it('returns preferred provider when mode is preferred and supported', () => {
      expect(getProviderOrder({ mode: 'preferred', preferredProvider: 'forge', runtime: 'web' })).toEqual(['forge']);
      expect(getProviderOrder({ mode: 'preferred', preferredProvider: 'imgur', runtime: 'android' })).toEqual(['imgur']);
      expect(getProviderOrder({ mode: 'preferred', preferredProvider: 'imgur', runtime: 'electron' })).toEqual(['imgur']);
      expect(getProviderOrder({ mode: 'preferred', preferredProvider: 'imgbb', runtime: 'android' })).toEqual(['imgbb']);
    });

    it("falls back to the runtime's first provider when the preferred one is not supported there", () => {
      expect(getProviderOrder({ mode: 'preferred', preferredProvider: 'catbox', runtime: 'web' })).toEqual(['forge']);
      expect(getProviderOrder({ mode: 'preferred', preferredProvider: 'imgbb', runtime: 'web' })).toEqual(['forge']);
    });

    it('uses forge everywhere with the default settings (preferred + forge)', () => {
      expect(getProviderOrder({ mode: 'preferred', preferredProvider: 'forge', runtime: 'web' })).toEqual(['forge']);
      expect(getProviderOrder({ mode: 'preferred', preferredProvider: 'forge', runtime: 'electron' })).toEqual(['forge']);
      expect(getProviderOrder({ mode: 'preferred', preferredProvider: 'forge', runtime: 'android' })).toEqual(['forge']);
    });

    it('returns shuffled list when mode is random', () => {
      const order = getProviderOrder({ mode: 'random', preferredProvider: 'catbox', runtime: 'electron' });
      expect(order).toHaveLength(4);
      expect([...order].sort()).toEqual(['catbox', 'forge', 'imgbb', 'imgur']);
    });

    it('filters unavailable providers from random mode', () => {
      const order = getProviderOrder({ mode: 'random', preferredProvider: 'catbox', runtime: 'electron', availability: { imgur: 'unavailable' } });
      expect([...order].sort()).toEqual(['catbox', 'forge', 'imgbb']);
    });

    it('returns empty when preferred provider is unavailable', () => {
      expect(getProviderOrder({ mode: 'preferred', preferredProvider: 'imgbb', runtime: 'android', availability: { imgbb: 'unavailable' } })).toEqual([]);
    });

    it('returns empty on web when forge is unavailable from this network', () => {
      expect(getProviderOrder({ mode: 'random', preferredProvider: 'catbox', runtime: 'web', availability: { forge: 'unavailable' } })).toEqual([]);
    });

    it('includes forge with the automated providers in android random mode', () => {
      const order = getProviderOrder({ mode: 'random', preferredProvider: 'catbox', runtime: 'android', availability: { forge: 'available' } });
      expect([...order].sort()).toEqual(['catbox', 'forge', 'imgbb', 'imgur']);
    });
  });

  describe('getEnabledProviders', () => {
    it('lists enabled providers in display order without shuffling', () => {
      expect(getEnabledProviders({ mode: 'random', preferredProvider: 'forge', runtime: 'electron' })).toEqual(['forge', 'catbox', 'imgur', 'imgbb']);
    });
  });
});

describe('provider file kinds', () => {
  it('reads the kind from the MIME type, falling back to the extension', () => {
    expect(getMediaFileKind('image/png', 'a.png')).toBe('image');
    expect(getMediaFileKind('video/webm', 'a.webm')).toBe('video');
    expect(getMediaFileKind('audio/mpeg', 'a.mp3')).toBe('audio');
    expect(getMediaFileKind('application/pdf', 'a.pdf')).toBe('pdf');
    expect(getMediaFileKind('', 'clip.MP4')).toBe('video');
    expect(getMediaFileKind('application/octet-stream', 'paper.pdf')).toBe('pdf');
    expect(getMediaFileKind('application/zip', 'a.zip')).toBeNull();
  });

  it('lists the kinds the providers host', () => {
    expect(getProvidersFileKinds(['forge'])).toEqual(['image', 'video']);
    expect(getProvidersFileKinds(['imgbb', 'catbox'])).toEqual(['image', 'video', 'audio', 'pdf']);
    expect(getProvidersFileKinds([])).toEqual([]);
  });

  it("offers the picker only Forge's formats, and whole kinds for the other providers", () => {
    expect(getProvidersAccept(['forge'])).toEqual({
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
    });
    expect(getProvidersAccept(['imgbb'])).toEqual({ 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic', '.bmp'] });
    expect(Object.keys(getProvidersAccept(['forge', 'catbox']))).toEqual(
      expect.arrayContaining(['image/jpeg', 'video/webm', 'image/*', 'video/*', 'audio/*', 'application/pdf']),
    );
    expect(getProvidersAccept([])).toEqual({});
  });

  it('keeps only providers that host the file, or all of them when its kind is unknown', () => {
    expect(filterProvidersForFile(['forge', 'catbox', 'imgbb'], 'application/pdf', 'paper.pdf')).toEqual(['catbox']);
    expect(filterProvidersForFile(['forge', 'imgbb'], 'video/mp4', 'clip.mp4')).toEqual(['forge']);
    expect(filterProvidersForFile(['forge', 'imgbb'], 'application/zip', 'a.zip')).toEqual(['forge', 'imgbb']);
  });

  it('keeps Forge only for the formats its API accepts', () => {
    expect(filterProvidersForFile(['forge', 'catbox'], 'image/heic', 'IMG_0001.HEIC')).toEqual(['catbox']);
    expect(filterProvidersForFile(['forge', 'catbox'], 'video/quicktime', 'clip.mov')).toEqual(['catbox']);
    expect(filterProvidersForFile(['forge'], 'image/png', 'shot.png')).toEqual(['forge']);
    // A nonstandard MIME type with a known extension, or no MIME type at all.
    expect(filterProvidersForFile(['forge'], 'image/jpg', 'photo.jpg')).toEqual(['forge']);
    expect(filterProvidersForFile(['forge'], '', 'clip.WEBM')).toEqual(['forge']);
  });
});
