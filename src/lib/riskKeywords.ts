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
 * Canonical risk keyword constants.
 * Single source of truth for DOM-based risk detection in the content script.
 */

// Keywords matched against compact wiki table cell text (method name, page title,
// requirements, category). Intentionally differs from WILDERNESS_WIKITEXT_KEYWORDS in
// background.js, which matches full article body text from MediaWiki action=parse.
// This list includes specific location names and orb methods that appear in table cells
// but not in article phrase-level risk warnings. Keep shared boss/location names in sync.
export const WILDERNESS_DOM_KEYWORDS: readonly string[] = [
  'wilderness', 'wildy', 'pvp', 'ferox enclave', 'rev cave', 'revenant cave',
  'mage arena', 'chaos temple', 'deep wild', 'level 30 wild', 'revenant',
  'scorpia', 'venenatis', 'vetion', "vet'ion", 'callisto', 'artio', 'spindel',
  "calvar'ion", 'calvarion', 'chaos fanatic', 'crazy archaeologist',
  'chaos elemental', 'lava dragon', 'rogue chest', 'zombie pirate',
  'black chinchompa', 'air orb', 'water orb', 'earth orb', 'fire orb',
] as const;

/** Keywords that indicate general high risk/volatility when found in row text or requirements */
export const RISKY_DOM_KEYWORDS: readonly string[] = [
  'risky', 'volatile', 'unstable', 'slow ge resale', 'considerable risk', 'test sales',
] as const;
