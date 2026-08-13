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
 * Canonical page-title normalization.
 *
 * Wiki page titles reach us in several shapes: underscores vs spaces, mixed
 * case, stray whitespace. Historically the code normalized ad hoc at each call
 * site (`t.replace(/_/g, ' ')`, `warningMap[t] || warningMap[t.toLowerCase()]`),
 * which made it easy for a "store" site and a "lookup" site to disagree.
 *
 * These two helpers are the single source of truth:
 *   - displayTitle: human-facing form ("Money making guide/Killing X")
 *   - titleKey:     the map key used for warningCache / warningMap lookups
 */

/** Normalize a title to its human-readable display form (underscores -> spaces, trimmed). */
export function displayTitle(title: string): string {
  return (title || '').replace(/_/g, ' ').trim();
}

/** Produce the canonical lookup key for a title (display form, lower-cased). */
export function titleKey(title: string): string {
  return displayTitle(title).toLowerCase();
}
