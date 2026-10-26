import type { ProviderAttempt } from './types';

export type { ProviderAttempt } from './types';

type TranslateFn = (key: string) => string;

function formatSingleAttempt(a: ProviderAttempt): string {
  const base = `${a.provider}: ${a.error ?? 'unknown'}`;
  const parts: string[] = [base];
  if (a.stage) parts.push(`stage=${a.stage}`);
  if (a.elapsedMs != null) parts.push(`${a.elapsedMs}ms`);
  if (a.matchedSelectors?.length) parts.push(`tried=[${a.matchedSelectors.join(', ')}]`);
  return parts.length > 1 ? `${base} (${parts.slice(1).join(', ')})` : base;
}

/**
 * Formats aggregated error message when all providers fail (random mode).
 * Includes stage, elapsed time, and matched selectors when available for actionable UI logs.
 */
export function formatAggregatedError(attempts: ProviderAttempt[], t: TranslateFn): string {
  const details = attempts.map(formatSingleAttempt).join('; ');
  return `${t('upload_failed')}. ${t('upload_failed_all_providers')}: ${details}`;
}

/**
 * Formats error for preferred mode with actionable guidance.
 */
export function formatPreferredModeError(errorMessage: string, t: TranslateFn): string {
  return `${t('upload_failed')}: ${errorMessage}. ${t('upload_failed_preferred_guidance')}`;
}
