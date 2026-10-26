// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { getEnabledProviders, getRandomOrder, getProviderOrder, resolveUploadSettings } from './provider-order';
import { filterProvidersForFileKind, getFileKindMimeTypes, getMediaFileKind, getProvidersFileKinds } from './providers';

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

  it('lists the kinds the providers host and the matching picker types', () => {
    expect(getProvidersFileKinds(['forge'])).toEqual(['image', 'video']);
    expect(getProvidersFileKinds(['imgbb', 'catbox'])).toEqual(['image', 'video', 'audio', 'pdf']);
    expect(getProvidersFileKinds([])).toEqual([]);
    expect(getFileKindMimeTypes(['image', 'pdf'])).toEqual(['image/*', 'application/pdf']);
  });

  it('keeps only providers that host the kind, or all of them when the kind is unknown', () => {
    expect(filterProvidersForFileKind(['forge', 'catbox', 'imgbb'], 'pdf')).toEqual(['catbox']);
    expect(filterProvidersForFileKind(['forge', 'imgbb'], 'video')).toEqual(['forge']);
    expect(filterProvidersForFileKind(['forge', 'imgbb'], null)).toEqual(['forge', 'imgbb']);
  });
});
