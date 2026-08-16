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
 * Pure filter engine — evaluates rows against filter criteria with zero DOM dependencies.
 * This module is the single source of truth for all filter logic.
 */

import { ROI_UNAVAILABLE, type FilterState, type RowData, type RowVerdict, type SubpageWarning, type IntensityFilter, type BudgetFilter, type RoiFilter, type XpGained, type XpSkillFilter, type MinXpFilter } from '../types';
import { WILDERNESS_DOM_KEYWORDS, RISKY_DOM_KEYWORDS } from './riskKeywords';

/**
 * Determine the intensity level from cell text.
 * 0 = unspecified, 1 = low, 2 = moderate, 3 = high
 */
export function getIntensityLevel(text: string): number {
  const norm = text.toLowerCase();
  if (norm.includes('low')) return 1;
  if (norm.includes('moderate') || norm.includes('medium')) return 2;
  if (norm.includes('high')) return 3;
  return 0;
}

/**
 * Check if a row passes the intensity filter.
 */
export function passesIntensityFilter(
  selected: IntensityFilter,
  intensityLevel: number,
  intensityText: string
): boolean {
  if (selected === 'none') return true;
  if (selected === 'low') {
    return intensityLevel === 1 || intensityText.includes('low');
  }
  if (selected === 'moderate') {
    return (
      intensityLevel === 1 ||
      intensityLevel === 2 ||
      intensityLevel === 0 ||
      (!intensityText.includes('high') && intensityLevel !== 3)
    );
  }
  if (selected === 'high') {
    return intensityLevel === 3 || intensityText.includes('high');
  }
  return true;
}

/**
 * Check if a row passes the budget filter.
 */
export function passesBudgetFilter(inputCost: number, selected: BudgetFilter): boolean {
  if (selected === 'none') return true;
  const thresholds: Record<string, number> = {
    '100k': 100_000,
    '1m': 1_000_000,
    '5m': 5_000_000,
    '10m': 10_000_000,
  };
  const threshold = thresholds[selected];
  return threshold ? inputCost <= threshold : true;
}

/**
 * Check if a row passes the ROI filter.
 */
export function passesRoiFilter(roi: number, selected: RoiFilter): boolean {
  if (selected === 'none') return true;
  const minRoi = parseInt(selected, 10);
  return isNaN(minRoi) ? true : roi >= minRoi;
}

/**
 * Check if any risk keywords match in the row's text fields.
 */
function isRiskMatch(row: RowData, keywords: readonly string[]): boolean {
  const fields = [
    row.methodName.toLowerCase(),
    (row.pageTitle || '').toLowerCase(),
    row.requirementText.toLowerCase(),
    row.categoryText.toLowerCase(),
  ];
  return keywords.some((kw) => fields.some((f) => f.includes(kw)));
}

/**
 * Evaluate a single row against all filter criteria.
 * Returns a verdict indicating visibility and which filters (if any) hid the row.
 */
export function evaluateRow(
  row: RowData,
  filters: FilterState,
  warning: SubpageWarning | null
): RowVerdict {
  const reasons: string[] = [];
  const intensityLevel = getIntensityLevel(row.intensityText);

  // 1. Intensity
  if (!passesIntensityFilter(filters.intensity, intensityLevel, row.intensityText)) {
    reasons.push('intensity');
  }

  // 2. Exclusions
  if (
    filters.excludedMethods.some((ex) =>
      row.methodName.toLowerCase().includes(ex.toLowerCase())
    )
  ) {
    reasons.push('excluded');
  }

  // 3. Risk (DOM-based + subpage-based)
  const isWilderness =
    isRiskMatch(row, WILDERNESS_DOM_KEYWORDS) || (warning?.hasWildernessWarning ?? false);

  if (filters.hideWilderness && isWilderness) reasons.push('wilderness');

  const isRisky =
    isRiskMatch(row, RISKY_DOM_KEYWORDS) || (warning?.hasWarning ?? false);

  if (filters.hideRisky && isRisky) reasons.push('risky');

  // 4. Budget
  const inputCost = warning?.inputCost ?? 0;
  if (!passesBudgetFilter(inputCost, filters.maxBudget)) reasons.push('budget');

  // 5. ROI
  const roi = warning?.roi ?? ROI_UNAVAILABLE;
  if (!passesRoiFilter(roi, filters.minRoi)) reasons.push('roi');

  // 6. Stats
  if (filters.playerStats && filters.filterByStats) {
    for (const req of row.parsedRequirements) {
      if ((filters.playerStats[req.skill] ?? 1) < req.level) {
        reasons.push('stats');
        break;
      }
    }
  }

  // 7. Experience Gained
  if (!passesXpFilter(warning?.xpGained, filters.xpSkill, filters.minXp, warning?.finParsed ?? false)) {
    reasons.push('xp');
  }

  return { visible: reasons.length === 0, reasons };
}

/** Convert MinXpFilter enum to numeric XP/hr threshold */
export function parseMinXpThreshold(minXp: MinXpFilter): number {
  if (minXp === '10k') return 10_000;
  if (minXp === '25k') return 25_000;
  if (minXp === '50k') return 50_000;
  if (minXp === '100k') return 100_000;
  return 0;
}

/** Check if subpage XP data passes skill and min XP/hr criteria */
export function passesXpFilter(
  xpGained: XpGained[] | undefined,
  xpSkill: XpSkillFilter,
  minXp: MinXpFilter,
  finParsed: boolean
): boolean {
  if (xpSkill === 'all' && minXp === 'none') return true;
  // Keep row visible if financial/xp data has not yet been fetched
  if (!finParsed || !xpGained) return true;

  const minThreshold = parseMinXpThreshold(minXp);

  if (xpSkill === 'all') {
    const maxSkillXp = xpGained.reduce((max, item) => Math.max(max, item.xp), 0);
    return maxSkillXp >= minThreshold;
  }

  if (xpSkill === 'any') {
    return xpGained.some((item) => item.xp >= minThreshold);
  }

  const skillLower = xpSkill.toLowerCase();

  if (skillLower === 'combat') {
    const combatSkills = ['attack', 'defence', 'strength', 'hitpoints', 'ranged', 'magic', 'prayer', 'combat level'];
    return xpGained.some(
      (item) => combatSkills.includes(item.skill.toLowerCase()) && item.xp >= minThreshold
    );
  }

  return xpGained.some(
    (item) => item.skill.toLowerCase() === skillLower && item.xp >= minThreshold
  );
}

/**
 * Check if a row passes all non-financial criteria (intensity, exclusion, stats).
 * Used to determine which methods to fetch financials for.
 */
export function passesNonFinancialCriteria(
  row: RowData,
  filters: FilterState
): boolean {
  const intensityLevel = getIntensityLevel(row.intensityText);

  if (!passesIntensityFilter(filters.intensity, intensityLevel, row.intensityText)) {
    return false;
  }

  if (
    filters.excludedMethods.some((ex) =>
      row.methodName.toLowerCase().includes(ex.toLowerCase())
    )
  ) {
    return false;
  }

  if (filters.playerStats && filters.filterByStats) {
    for (const req of row.parsedRequirements) {
      if ((filters.playerStats[req.skill] ?? 1) < req.level) {
        return false;
      }
    }
  }

  return true;
}
