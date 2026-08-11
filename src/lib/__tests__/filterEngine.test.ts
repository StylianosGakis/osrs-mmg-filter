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
import { describe, it, expect } from 'vitest';
import {
  evaluateRow,
  passesIntensityFilter,
  passesBudgetFilter,
  passesRoiFilter,
  passesXpFilter,
  passesNonFinancialCriteria,
  getIntensityLevel,
} from '../filterEngine';
import type { FilterState, RowData, SubpageWarning } from '../../types';

const baseRow: RowData = {
  methodName: 'Killing blue dragons',
  pageTitle: 'Money making guide/Killing blue dragons',
  intensityText: 'medium',
  requirementText: '70 Agility',
  categoryText: 'Combat',
  parsedRequirements: [{ skill: 'agility', level: 70 }],
};

const defaultFilters: FilterState = {
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

const defaultWarning: SubpageWarning = {
  hasWildernessWarning: false,
  hasWarning: false,
  inputCost: 500_000,
  grossOutput: 1_200_000,
  roi: 140,
  xpGained: [{ skill: 'Magic', xp: 129_600 }],
  finParsed: true,
};

describe('getIntensityLevel', () => {
  it('returns 1 for low', () => expect(getIntensityLevel('low')).toBe(1));
  it('returns 2 for moderate', () => expect(getIntensityLevel('moderate')).toBe(2));
  it('returns 2 for medium', () => expect(getIntensityLevel('medium')).toBe(2));
  it('returns 3 for high', () => expect(getIntensityLevel('high')).toBe(3));
  it('returns 0 for unknown', () => expect(getIntensityLevel('varies')).toBe(0));
});

describe('passesIntensityFilter', () => {
  it('passes everything when filter is none', () => {
    expect(passesIntensityFilter('none', 1, 'low')).toBe(true);
    expect(passesIntensityFilter('none', 3, 'high')).toBe(true);
  });

  it('filters to low only', () => {
    expect(passesIntensityFilter('low', 1, 'low')).toBe(true);
    expect(passesIntensityFilter('low', 2, 'moderate')).toBe(false);
    expect(passesIntensityFilter('low', 3, 'high')).toBe(false);
  });

  it('filters to moderate or lower', () => {
    expect(passesIntensityFilter('moderate', 1, 'low')).toBe(true);
    expect(passesIntensityFilter('moderate', 2, 'moderate')).toBe(true);
    expect(passesIntensityFilter('moderate', 0, 'varies')).toBe(true);
    expect(passesIntensityFilter('moderate', 3, 'high')).toBe(false);
  });

  it('filters to high only', () => {
    expect(passesIntensityFilter('high', 3, 'high')).toBe(true);
    expect(passesIntensityFilter('high', 1, 'low')).toBe(false);
  });
});

describe('passesBudgetFilter', () => {
  it('passes everything when filter is none', () => {
    expect(passesBudgetFilter(999_999_999, 'none')).toBe(true);
  });

  it('filters by 100k', () => {
    expect(passesBudgetFilter(50_000, '100k')).toBe(true);
    expect(passesBudgetFilter(100_000, '100k')).toBe(true);
    expect(passesBudgetFilter(100_001, '100k')).toBe(false);
  });

  it('filters by 1m', () => {
    expect(passesBudgetFilter(1_000_000, '1m')).toBe(true);
    expect(passesBudgetFilter(1_000_001, '1m')).toBe(false);
  });
});

describe('passesRoiFilter', () => {
  it('passes everything when filter is none', () => {
    expect(passesRoiFilter(5, 'none')).toBe(true);
  });

  it('filters by 15% ROI', () => {
    expect(passesRoiFilter(15, '15')).toBe(true);
    expect(passesRoiFilter(14, '15')).toBe(false);
  });

  it('filters by 50% ROI', () => {
    expect(passesRoiFilter(50, '50')).toBe(true);
    expect(passesRoiFilter(49, '50')).toBe(false);
  });
});

describe('evaluateRow', () => {
  it('shows row when no filters active', () => {
    const result = evaluateRow(baseRow, defaultFilters, null);
    expect(result.visible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('hides row when intensity filter excludes it', () => {
    const result = evaluateRow(baseRow, { ...defaultFilters, intensity: 'low' }, null);
    expect(result.visible).toBe(false);
    expect(result.reasons).toContain('intensity');
  });

  it('hides wilderness methods when toggle active', () => {
    const wildRow: RowData = { ...baseRow, methodName: 'Killing revenant knights' };
    const result = evaluateRow(wildRow, { ...defaultFilters, hideWilderness: true }, null);
    expect(result.visible).toBe(false);
    expect(result.reasons).toContain('wilderness');
  });

  it('hides wilderness methods via subpage warning', () => {
    const warning: SubpageWarning = { ...defaultWarning, hasWildernessWarning: true };
    const result = evaluateRow(baseRow, { ...defaultFilters, hideWilderness: true }, warning);
    expect(result.visible).toBe(false);
    expect(result.reasons).toContain('wilderness');
  });

  it('hides risky methods via subpage warning', () => {
    const warning: SubpageWarning = { ...defaultWarning, hasWarning: true };
    const result = evaluateRow(baseRow, { ...defaultFilters, hideRisky: true }, warning);
    expect(result.visible).toBe(false);
    expect(result.reasons).toContain('risky');
  });

  it('hides risky methods via DOM keywords', () => {
    const riskyRow: RowData = { ...baseRow, methodName: 'Creating eternal glories (volatile)' };
    const result = evaluateRow(riskyRow, { ...defaultFilters, hideRisky: true }, null);
    expect(result.visible).toBe(false);
    expect(result.reasons).toContain('risky');
  });

  it('does not check risk or budget', () => {
    // Non-financial criteria should NOT check hideWilderness/maxBudget/minRoi
    const wildRow: RowData = { ...baseRow, methodName: 'Killing revenant knights' };
    expect(passesNonFinancialCriteria(wildRow, { ...defaultFilters, hideWilderness: true })).toBe(true);
  });
});

describe('passesXpFilter', () => {
  const sampleXp = [{ skill: 'Magic', xp: 50_000 }, { skill: 'Mining', xp: 9_000 }];

  it('passes all when skill is all and minXp is none', () => {
    expect(passesXpFilter(sampleXp, 'all', 'none', true)).toBe(true);
  });

  it('filters by skill', () => {
    expect(passesXpFilter(sampleXp, 'Magic', 'none', true)).toBe(true);
    expect(passesXpFilter(sampleXp, 'Agility', 'none', true)).toBe(false);
  });

  it('filters by min XP threshold', () => {
    expect(passesXpFilter(sampleXp, 'Magic', '25k', true)).toBe(true);
    expect(passesXpFilter(sampleXp, 'Magic', '100k', true)).toBe(false);
  });

  it('filters by any skill XP', () => {
    expect(passesXpFilter(sampleXp, 'any', '25k', true)).toBe(true);
    expect(passesXpFilter(sampleXp, 'any', '100k', true)).toBe(false);
  });

  it('keeps rows visible if data is not yet parsed', () => {
    expect(passesXpFilter(undefined, 'Magic', '100k', false)).toBe(true);
  });
});
