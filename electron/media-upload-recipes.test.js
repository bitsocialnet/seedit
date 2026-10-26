/**
 * Tests for media-upload-recipes validation.
 * Recipes are validated at module load; these tests verify the validation logic.
 */
import { describe, expect, it } from 'vitest';
import { MEDIA_UPLOAD_RECIPES, validateRecipes } from './media-upload-recipes.js';

describe('media-upload-recipes', () => {
  it('exports MEDIA_UPLOAD_RECIPES with expected providers', () => {
    expect(Object.keys(MEDIA_UPLOAD_RECIPES)).toContain('catbox');
    expect(Object.keys(MEDIA_UPLOAD_RECIPES)).toContain('imgur');
    expect(Object.keys(MEDIA_UPLOAD_RECIPES)).toContain('imgbb');
  });

  it('validateRecipes passes for current recipes', () => {
    expect(() => validateRecipes()).not.toThrow();
  });

  it('every provider has trigger, success, blocked selectors and timeout', () => {
    for (const recipe of Object.values(MEDIA_UPLOAD_RECIPES)) {
      expect(recipe.fileInputSelectorCandidates?.length).toBeGreaterThan(0);
      expect(recipe.submitSelectorCandidates?.length).toBeGreaterThan(0);
      expect(recipe.successExtractor?.selectorCandidates?.length).toBeGreaterThan(0);
      expect(recipe.successExtractor?.attribute).toBeTruthy();
      expect(recipe.blockedIndicators?.length).toBeGreaterThan(0);
      expect(typeof recipe.timeoutMs).toBe('number');
      expect(recipe.timeoutMs).toBeGreaterThan(0);
    }
  });

  it('imgur has 45s timeout (parity with Android)', () => {
    expect(MEDIA_UPLOAD_RECIPES.imgur.timeoutMs).toBe(45_000);
  });

  it('imgbb targets full image embed codes and has Android parity timeout', () => {
    expect(MEDIA_UPLOAD_RECIPES.imgbb.timeoutMs).toBe(60_000);
    expect(MEDIA_UPLOAD_RECIPES.imgbb.uploadUrl).toBe('https://imgbb.com/');
    expect(MEDIA_UPLOAD_RECIPES.imgbb.successExtractor.selectorCandidates).toContain('input[name="html-embed-medium"]');
  });

  it('selector fallback order: generic file input before provider-specific', () => {
    for (const [, recipe] of Object.entries(MEDIA_UPLOAD_RECIPES)) {
      const first = recipe.fileInputSelectorCandidates[0];
      expect(first).toMatch(/input\[type\s*=\s*["']?file["']?\]/i);
    }
  });
});
