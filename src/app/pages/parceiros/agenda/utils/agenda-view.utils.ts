import { Profissional } from '../../../../types/agenda.types';

export function hourOr(val: unknown, fallback: number): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Stable work-day window for day/timeline views (strings from API-safe). */
export function normalizeWorkWindow(
  startRaw: unknown,
  endRaw: unknown,
  cfgStart: number,
  cfgEnd: number,
): { start: number; end: number } {
  let start = hourOr(startRaw, hourOr(cfgStart, 8));
  let end = hourOr(endRaw, hourOr(cfgEnd, 19));
  start = Math.max(0, Math.min(23, Math.floor(start)));
  end = Math.max(1, Math.min(24, Math.ceil(end)));
  if (end <= start) {
    end = Math.min(24, start + 1);
  }
  return { start, end };
}

/** Single object mistaken for array (e.g. debug bindings) → one column. */
export function profissionaisAsList(
  p: Profissional[] | Profissional | null | undefined,
): Profissional[] {
  if (Array.isArray(p)) return p;
  if (p && typeof p === 'object' && 'id' in p) return [p];
  return [];
}
