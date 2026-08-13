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
 * Pure parsers for MediaWiki `action=parse` output.
 *
 * These functions turn a rendered MMG subpage (HTML string + categories +
 * templates) into structured financial / risk / XP data. They are the most
 * brittle part of the extension — a wiki template change can silently shift the
 * numbers — so they live here, isolated from all chrome / network concerns, and
 * are covered by fixture-based tests in __tests__/wikiParse.test.ts.
 */

import type { XpGained } from '../types';
import { WILDERNESS_WIKITEXT_KEYWORDS, RISK_SIGNAL_WORDS } from './riskKeywords';

/** MediaWiki action=parse category entry (shape varies by API version). */
export interface ParseCategory {
  '*'?: string;
  title?: string;
  name?: string;
}

/** MediaWiki action=parse template entry. */
export interface ParseTemplate {
  '*'?: string;
  title?: string;
}

/** Financial metrics parsed out of a rendered MMG subpage. */
export interface Financials {
  inputCost: number;
  grossOutput: number;
  roi: number;
  outputVolume: number;
}

/** Risk flags derived from a rendered MMG subpage. */
export interface RiskFlags {
  hasWildernessWarning: boolean;
  hasWarning: boolean;
}

const COMBAT_TITLE_PREFIXES = [
  'killing', 'chambers of', 'theatre of', 'tombs of', 'moons of', 'barrows',
  'fortis colosseum', 'the gauntlet', 'the corrupted gauntlet', 'last man standing'
];

const ITEM_CREATION_KEYWORDS = [
  'smelting', 'tanning', 'making', 'fletching', 'cooking', 'crafting',
  'grinding', 'crushing', 'casting', 'enchanting', 'charging', 'cleaning',
  'collecting', 'cutting', 'opening', 'exchanging', 'stringing', 'humidifying',
  'decanting', 'baking', 'brewing', 'spinning', 'mining', 'catching',
  'hunting', 'harvesting', 'picking', 'chopping', 'buying', 'plucking'
];

/** Strip the global navbox tables at the bottom of a page (links to every other method). */
function stripNavbox(html: string): string {
  const cleanHtml = html || '';
  const navboxIndex = cleanHtml.search(/<table[^>]*class="[^"]*navbox/i);
  return navboxIndex !== -1 ? cleanHtml.substring(0, navboxIndex) : cleanHtml;
}

export function isVolumeApplicable(
  rawTitle: string,
  categories: ParseCategory[],
  outputItemCount: number
): boolean {
  const subpageTitle = rawTitle.replace(/^Money making guide\//i, '').toLowerCase();

  // Exclude combat, bossing, or raid methods
  if (COMBAT_TITLE_PREFIXES.some((p) => subpageTitle.includes(p))) return false;
  if (categories.some((c) => (c['*'] || c.name || '').includes('MMG/Combat'))) return false;

  // Must have 1 or 2 focused output items (not a multi-item drop table)
  if (outputItemCount < 1 || outputItemCount > 2) return false;

  // Check if title or category indicates item creation / processing / collecting
  const isCreationTitle = ITEM_CREATION_KEYWORDS.some((k) => subpageTitle.includes(k));
  const isCreationCategory = categories.some((c) => {
    const catName = c['*'] || c.name || '';
    return catName.includes('MMG/Processing') || catName.includes('MMG/Collecting');
  });

  return isCreationTitle || isCreationCategory;
}

export function extractXpGainedFromHtml(html: string): XpGained[] {
  if (!html) return [];
  const cleanHtml = stripNavbox(html);

  const results: XpGained[] = [];
  const expMatch = cleanHtml.match(/Experience gained[\s\S]*?<\/th>[\s\S]*?<td>([\s\S]*?)<\/td>/i) ||
                   cleanHtml.match(/<th[^>]*>[\s]*Experience gained[\s]*<\/th>\s*<\/tr>\s*<tr>[\s\S]*?<\/td>\s*<td>([\s\S]*?)<\/td>/i);

  const targetHtml = expMatch ? expMatch[1] : cleanHtml;
  const scpRegex = /data-skill="([^"]+)"[^>]*data-level="([^"]+)"/g;
  let match: RegExpExecArray | null;

  if (expMatch) {
    while ((match = scpRegex.exec(targetHtml)) !== null) {
      const skill = match[1].trim();
      const amountStr = match[2].replace(/,/g, '').replace(/\+/g, '').trim();
      const amount = parseInt(amountStr, 10);
      if (skill && !isNaN(amount) && skill.toLowerCase() !== 'achievement diary' && amount > 0) {
        results.push({ skill, xp: amount });
      }
    }
  }

  if (results.length === 0) {
    const mmgXpRegex = /<span[^>]*class="[^"]*mmg-xpline[^"]*"[\s\S]*?<span[^>]*data-skill="([^"]+)"[^>]*data-level="([^"]+)"/g;
    while ((match = mmgXpRegex.exec(cleanHtml)) !== null) {
      const skill = match[1].trim();
      const amountStr = match[2].replace(/,/g, '').replace(/\+/g, '').trim();
      const amount = parseInt(amountStr, 10);
      if (skill && !isNaN(amount) && skill.toLowerCase() !== 'achievement diary' && amount > 0) {
        results.push({ skill, xp: amount });
      }
    }
  }

  const skillMap = new Map<string, XpGained>();
  for (const item of results) {
    const existing = skillMap.get(item.skill);
    if (!existing || item.xp > existing.xp) {
      skillMap.set(item.skill, item);
    }
  }

  return Array.from(skillMap.values());
}

export function parseMmgFinancialsFromHtml(
  html: string,
  volumeMap: Record<string, number> = {},
  rawTitle = '',
  categories: ParseCategory[] = []
): Financials {
  if (!html) return { inputCost: 0, grossOutput: 0, roi: 99999, outputVolume: 0 };
  let totalInput = 0;
  let totalOutput = 0;

  const inputMatches = html.match(/class="[^"]*mmg-input[^"]*"[\s\S]*?<span class="coins[^"]*">([\d,]+)<\/span>/gi) || [];
  inputMatches.forEach((m) => {
    const numMatch = m.match(/<span class="coins[^"]*">([\d,]+)<\/span>/i);
    if (numMatch) {
      const val = parseInt(numMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(val)) totalInput += val;
    }
  });

  const outputMatches = html.match(/class="[^"]*mmg-output[^"]*"[\s\S]*?<span class="coins[^"]*">([\d,]+)<\/span>/gi) || [];
  outputMatches.forEach((m) => {
    const numMatch = m.match(/<span class="coins[^"]*">([\d,]+)<\/span>/i);
    if (numMatch) {
      const val = parseInt(numMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(val)) totalOutput += val;
    }
  });

  const netProfit = totalOutput - totalInput;
  const roi = totalInput > 0 ? (netProfit / totalInput) * 100 : 99999;

  let minOutputVolume = Infinity;
  let outputItemCount = 0;
  if (volumeMap && Object.keys(volumeMap).length > 0) {
    const outputBlocks = html.match(/class="[^"]*mmg-output[^"]*"[\s\S]*?(?=<span\s+class="[^"]*mmg-itemline|<\/td>|<\/div>|$)/gi) || [];
    const outputItemNames = new Set<string>();

    outputBlocks.forEach((block) => {
      const linkMatches = block.match(/<a[^>]*title="([^"]+)"[^>]*>/gi) || [];
      linkMatches.forEach((tag) => {
        const titleMatch = tag.match(/title="([^"]+)"/i);
        if (titleMatch) {
          const name = titleMatch[1].trim().toLowerCase();
          if (
            name !== 'coins' &&
            !name.includes(':') &&
            !name.includes('money making') &&
            !name.includes('grand exchange') &&
            !name.includes('ge tax') &&
            !name.includes('convenience fee')
          ) {
            outputItemNames.add(name);
          }
        }
      });
    });

    outputItemCount = outputItemNames.size;
    for (const itemName of outputItemNames) {
      if (volumeMap[itemName] !== undefined && volumeMap[itemName] > 0) {
        const vol = volumeMap[itemName];
        if (vol < minOutputVolume) minOutputVolume = vol;
      }
    }
  }

  const outputVolume = (minOutputVolume !== Infinity && isVolumeApplicable(rawTitle, categories, outputItemCount))
    ? minOutputVolume
    : 0;

  return {
    inputCost: totalInput,
    grossOutput: totalOutput,
    roi: Math.round(roi),
    outputVolume
  };
}

export function extractRiskFromParseData(
  html: string,
  categories: ParseCategory[] = [],
  templates: ParseTemplate[] = []
): RiskFlags {
  let hasWildernessWarning = false;
  let hasWarning = false;

  const cleanHtml = stripNavbox(html);
  const htmlLower = cleanHtml.toLowerCase();

  // Check page categories
  if (Array.isArray(categories)) {
    categories.forEach((c) => {
      const cTitle = (c['*'] || c.title || '').toLowerCase();
      if (cTitle.includes('mmg/risky') || cTitle.includes('risky')) {
        hasWarning = true;
      }
      if (cTitle.includes('wilderness') || cTitle.includes('pvp')) {
        hasWildernessWarning = true;
        hasWarning = true;
      }
    });
  }

  // Check page templates
  if (Array.isArray(templates)) {
    templates.forEach((t) => {
      const tName = (t['*'] || t.title || '').toLowerCase();
      if (
        tName.includes('wilderness') ||
        tName.includes('wildy') ||
        tName.includes('pvp') ||
        tName.includes('dangerous') ||
        tName.includes('danger')
      ) {
        hasWildernessWarning = true;
        hasWarning = true;
      }
      if (
        tName.includes('warning') ||
        tName.includes('notice') ||
        tName.includes('risk') ||
        tName.includes('disclaimer') ||
        tName.includes('caution') ||
        tName.includes('caveat') ||
        tName.includes('ambox') ||
        tName.includes('ombox') ||
        tName.includes('mmg warning') ||
        tName.includes('mmgwarning')
      ) {
        hasWarning = true;
      }
    });
  }

  // Check wikitext warning text rendered in HTML: a wilderness keyword must
  // co-occur with a generic risk-signal word for the page to count as risky.
  if (WILDERNESS_WIKITEXT_KEYWORDS.some((kw) => htmlLower.includes(kw))) {
    if (RISK_SIGNAL_WORDS.some((w) => htmlLower.includes(w))) {
      hasWildernessWarning = true;
      hasWarning = true;
    }
  }

  return { hasWildernessWarning, hasWarning };
}
