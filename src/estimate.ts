/**
 * Estymata czasowa wpisu (CalEvent.estimate, minuty): szybkie przyciski 5min / 30min / 1h / 2h+.
 * Widać ją w nawiasie za tytułem; w epiku sumuje się do „zostało ~…” (work.ts remainingEstimate).
 * W Google: extendedProperties.private.pulseEst.
 */

/** 120 = „2h+”. */
export const ESTIMATES = [5, 30, 60, 120] as const;

/**
 * „?” — nie wiem. Tylko w szkicu: pozwala zapisać wpis przy „wymagaj estymaty”, ale niczego nie zapisuje
 * i nigdzie się nie wyświetla (zapis zamienia ją na brak estymaty).
 */
export const UNKNOWN_ESTIMATE = -1;

/** Estymata do zapisu: tylko prawdziwe minuty (bez „?”). */
export const storedEstimate = (m?: number) => (m && m > 0 ? m : undefined);

export function estimateLabel(min: number): string {
  if (min >= 120) return "2h+";
  if (min >= 60) return `${Math.round(min / 60)}h`;
  return `${min}min`;
}

/** Suma minut po ludzku: „35min”, „3h”, „3h 35min”. */
export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  if (!h) return `${r}min`;
  return r ? `${h}h ${r}min` : `${h}h`;
}
