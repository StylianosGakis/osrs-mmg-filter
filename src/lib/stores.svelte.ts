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
 * Reactive state stores for the filter panel.
 * Uses Svelte 5 runes with chrome.storage.local sync.
 */

import type { FilterState, PlayerStats, SubpageWarning } from '../types';

/** Default filter state */
const DEFAULTS: FilterState = {
  intensity: 'none',
  hideWilderness: false,
  hideRisky: false,
  maxBudget: 'none',
  minRoi: 'none',
  xpSkill: 'all',
  minXp: 'none',
  excludedMethods: [],
  rsn: '',
  playerStats: null,
  filterByStats: true,
};

// ─── Filter State ─────────────────────────────────────────────
export const filters: FilterState = $state({ ...DEFAULTS });

// ─── Subpage Warning Map ──────────────────────────────────────
export const warningMap: Record<string, SubpageWarning> = $state({});

// ─── Sync Progress ────────────────────────────────────────────
export const syncProgress = $state({
  parsed: 0,
  total: 0,
  syncing: false,
  complete: false,
  stalled: false,
});

// ─── Financial Load State ─────────────────────────────────────
export const financialState = $state({
  hasLoaded: false,
  isSyncing: false,
});

// ─── Stats Lookup State ───────────────────────────────────────
export const statsState = $state({
  status: '' as string,
  isError: false,
});

// ─── Persistence ──────────────────────────────────────────────

/** Save current filter state to chrome.storage.local */
export function saveFilters(): void {
  if (chrome?.storage?.local) {
    chrome.storage.local.set({
      filterState_v2: {
        intensity: filters.intensity,
        hideWilderness: filters.hideWilderness,
        hideRisky: filters.hideRisky,
        maxBudget: filters.maxBudget,
        minRoi: filters.minRoi,
        xpSkill: filters.xpSkill,
        minXp: filters.minXp,
        excludedMethods: Array.isArray(filters.excludedMethods) ? [...filters.excludedMethods] : [],
        rsn: filters.rsn,
        playerStats: filters.playerStats,
        filterByStats: filters.filterByStats,
      },
    });
  }
}

/** Hydrate filter state from chrome.storage.local */
export async function hydrateFilters(): Promise<void> {
  if (!chrome?.storage?.local) return;

  return new Promise((resolve) => {
    chrome.storage.local.get(['filterState_v2'], (result) => {
      const stored = result['filterState_v2'] as Partial<FilterState> | undefined;
      if (stored) {
        Object.assign(filters, stored);
        if (!Array.isArray(filters.excludedMethods)) {
          filters.excludedMethods = filters.excludedMethods
            ? Object.values(filters.excludedMethods as Record<string, string>)
            : [];
        }
      }
      resolve();
    });
  });
}

/** Merge incoming warning data into the store */
export function mergeWarnings(incoming: Record<string, SubpageWarning>): void {
  Object.assign(warningMap, incoming);
}

/** Clear all filters to defaults */
export function clearAllFilters(): void {
  filters.intensity = DEFAULTS.intensity;
  filters.hideWilderness = DEFAULTS.hideWilderness;
  filters.hideRisky = DEFAULTS.hideRisky;
  filters.maxBudget = DEFAULTS.maxBudget;
  filters.minRoi = DEFAULTS.minRoi;
  filters.xpSkill = DEFAULTS.xpSkill;
  filters.minXp = DEFAULTS.minXp;
  filters.excludedMethods = [];
  filters.rsn = '';
  filters.playerStats = null;
  filters.filterByStats = true;
  statsState.status = '';
  statsState.isError = false;
  if (chrome?.storage?.local) {
    chrome.storage.local.remove(['rsn', 'playerStats']);
  }
  saveFilters();
}

/** Remove a method from the excluded list */
export function restoreMethod(name: string): void {
  filters.excludedMethods = filters.excludedMethods.filter(
    (s) => s.toLowerCase() !== name.toLowerCase()
  );
  saveFilters();
}

/** Add a method to the excluded list */
export function excludeMethod(name: string): void {
  if (!filters.excludedMethods.some((ex) => ex.toLowerCase() === name.toLowerCase())) {
    filters.excludedMethods = [...filters.excludedMethods, name];
    saveFilters();
  }
}
