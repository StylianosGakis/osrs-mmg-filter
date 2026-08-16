/*
 * OSRS MMG Filter - Filter the OSRS Wiki Money Making Guide table
 * Copyright (C) 2026  Stylianos Gakis
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see https://www.gnu.org/licenses/
 *
 * Source: https://github.com/StylianosGakis/osrs-mmg-filter
 */
/**
 * Utility formatters for GP values, intensity labels, etc.
 */

/** Format a GP number into a human-readable string (e.g., "19.7M GP", "100k GP") */
export function formatGp(num: number): string {
  if (!num || isNaN(num) || num <= 0) return '0 GP';
  if (num < 1_000) return num.toLocaleString() + ' GP';
  // Round to whole thousands first; if that rounds up to 1000k, promote to M so
  // we never render a misleading "1000k GP" for values just under 1M.
  const k = Math.round(num / 1_000);
  if (k < 1_000) return k + 'k GP';
  return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M GP';
}

/** Human-readable intensity labels */
export const INTENSITY_LABELS: Record<string, string> = {
  low: 'Low',
  moderate: 'Moderate or lower',
  high: 'High',
};

/** Human-readable budget labels */
export const BUDGET_LABELS: Record<string, string> = {
  '100k': '≤ 100k GP',
  '1m': '≤ 1M GP',
  '5m': '≤ 5M GP',
  '10m': '≤ 10M GP',
};

/** Human-readable ROI labels */
export const ROI_LABELS: Record<string, string> = {
  '15': '≥ 15% ROI',
  '50': '≥ 50% ROI',
};

/** Format an XP number into a human-readable string (e.g. "129.6k XP", "1.2M XP") */
export function formatXp(num: number): string {
  if (!num || isNaN(num) || num <= 0) return '0 XP';
  if (num < 1_000) return num.toLocaleString() + ' XP';
  // Round to one-decimal thousands first; if that rounds up to 1000k, promote to
  // M so we never render a misleading "1000k XP" for values just under 1M.
  const k = Math.round(num / 100) / 10;
  if (k < 1_000) return k.toFixed(1).replace(/\.0$/, '') + 'k XP';
  return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M XP';
}

/** Format a per-day GE trade volume into a human-readable string (e.g. "25k/d", "1.5M/d") */
export function formatVolume(vol: number): string {
  if (vol < 1_000) return `${vol}/d`;
  // Round to whole thousands first; if that rounds up to 1000k, promote to M so
  // we never render a misleading "1000k/d" for values just under 1M.
  const k = Math.round(vol / 1_000);
  if (k < 1_000) return `${k}k/d`;
  return `${(vol / 1_000_000).toFixed(1)}M/d`;
}
