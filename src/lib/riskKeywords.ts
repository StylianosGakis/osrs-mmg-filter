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
 * Canonical risk keyword constants — the single source of truth for risk
 * detection across BOTH the content script (compact table cell text) and the
 * background worker (full rendered article HTML).
 *
 * Boss/location names shared by both contexts live in WILDERNESS_CORE_KEYWORDS
 * so they can never drift out of sync. Each context then appends only the extra
 * phrases unique to the text it inspects.
 */

/**
 * Wilderness boss/location names that appear in both compact table cells and
 * full article bodies. Edit these once; both detection paths pick them up.
 */
export const WILDERNESS_CORE_KEYWORDS = [
  'wilderness', 'wildy', 'pvp', 'deep wild',
  'revenant', 'scorpia', 'venenatis', "vet'ion", 'vetion', 'callisto',
  'artio', 'spindel', "calvar'ion", 'calvarion', 'chaos fanatic',
  'crazy archaeologist', 'chaos elemental', 'lava dragon', 'rogue chest',
  'zombie pirate', 'black chinchompa',
] as const;

/**
 * Keywords matched against compact wiki table cell text (method name, page
 * title, requirements, category). Includes location names and orb methods that
 * appear in table cells but not in article phrase-level risk warnings.
 */
export const WILDERNESS_DOM_KEYWORDS: readonly string[] = [
  ...WILDERNESS_CORE_KEYWORDS,
  'ferox enclave', 'rev cave', 'revenant cave', 'mage arena', 'chaos temple',
  'level 30 wild', 'air orb', 'water orb', 'earth orb', 'fire orb',
] as const;

/**
 * Keywords matched against the full rendered article body (MediaWiki
 * action=parse HTML). Includes in-article phrases and risk warnings that do not
 * appear in compact table rows.
 */
export const WILDERNESS_WIKITEXT_KEYWORDS: readonly string[] = [
  ...WILDERNESS_CORE_KEYWORDS,
  'pker', 'pkers', 'pked', 'high risk', 'loss of items',
  'items you are not willing to lose', 'located in wilderness',
  'fountain of rune', 'rogues castle',
] as const;

/** Keywords that indicate general high risk/volatility when found in row text or requirements */
export const RISKY_DOM_KEYWORDS: readonly string[] = [
  'risky', 'volatile', 'unstable', 'slow ge resale', 'considerable risk', 'test sales',
] as const;

/**
 * Generic "this article carries a risk/warning notice" signal words. Used
 * together with a wilderness keyword to decide whether rendered article text
 * actually describes danger (rather than merely mentioning a boss name).
 */
export const RISK_SIGNAL_WORDS: readonly string[] = [
  'warning', 'notice', 'danger', 'risk', 'wilderness',
] as const;
