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
export interface XpGained {
  skill: string;
  xp: number;
}

/** Warning/financial data for a single MMG subpage */
export interface SubpageWarning {
  hasWildernessWarning: boolean;
  hasWarning: boolean;
  inputCost: number;
  grossOutput: number;
  roi: number;
  outputVolume?: number;
  xpGained?: XpGained[];
  finParsed: boolean;
}

/** Player skill levels from Hiscores */
export type PlayerStats = Record<string, number>;

/** Persisted filter state */
export interface FilterState {
  intensity: IntensityFilter;
  hideWilderness: boolean;
  hideRisky: boolean;
  maxBudget: BudgetFilter;
  minRoi: RoiFilter;
  xpSkill: XpSkillFilter;
  minXp: MinXpFilter;
  excludedMethods: string[];
  rsn: string;
  playerStats: PlayerStats | null;
  filterByStats: boolean;
}

export type IntensityFilter = 'none' | 'low' | 'moderate' | 'high';
export type BudgetFilter = 'none' | '100k' | '1m' | '5m' | '10m';
export type RoiFilter = 'none' | '15' | '50';
export type XpSkillFilter = 'all' | 'any' | string;
export type MinXpFilter = 'none' | '10k' | '25k' | '50k' | '100k';

/** Skill requirement parsed from a table cell */
export interface SkillRequirement {
  skill: string;
  level: number;
}

/** Row data extracted from the wiki table for filter evaluation */
export interface RowData {
  methodName: string;
  pageTitle: string | null;
  intensityText: string;
  requirementText: string;
  categoryText: string;
  parsedRequirements: SkillRequirement[];
}

/** Result of evaluating a row against filters */
export interface RowVerdict {
  visible: boolean;
  reasons: string[];
}

/** Messages: Content → Background (requests) */
export type ContentMessage =
  | { action: 'fetchPlayerStats'; username: string }
  | { action: 'checkPageWarnings'; pageTitles: string[] }
  | { action: 'purgeFinancialCache'; pageTitles: string[] };

/** Messages: Background → Content (pushes) */
export type BackgroundMessage =
  | {
      action: 'warningsUpdated';
      warningMap: Record<string, SubpageWarning>;
      parsedCount: number;
      totalTitles: number;
      isComplete: boolean;
    }
  | {
      action: 'syncLog';
      level: 'log' | 'warn' | 'error';
      message: string;
      details?: string;
    };

/** Response from background for fetchPlayerStats */
export interface PlayerStatsResponse {
  success: boolean;
  stats?: PlayerStats;
  error?: string;
}

/** Response from background for checkPageWarnings / purgeFinancialCache */
export interface WarningResponse {
  success: boolean;
  warningMap?: Record<string, SubpageWarning>;
  error?: string;
}
