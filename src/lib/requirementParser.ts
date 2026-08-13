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
import type { SkillRequirement } from '../types';

/**
 * Skill name aliases for matching wiki text to canonical OSRS skill names.
 */
export const SKILL_ALIASES: Record<string, string> = {
  attack: 'attack', atk: 'attack',
  defence: 'defence', defense: 'defence', def: 'defence',
  strength: 'strength', str: 'strength',
  hitpoints: 'hitpoints', hp: 'hitpoints', health: 'hitpoints',
  ranged: 'ranged', range: 'ranged',
  prayer: 'prayer', pray: 'prayer',
  magic: 'magic', mage: 'magic',
  cooking: 'cooking', cook: 'cooking',
  woodcutting: 'woodcutting', wc: 'woodcutting',
  fletching: 'fletching', fletch: 'fletching',
  fishing: 'fishing', fish: 'fishing',
  firemaking: 'firemaking', fm: 'firemaking',
  crafting: 'crafting', craft: 'crafting',
  smithing: 'smithing', smith: 'smithing',
  mining: 'mining', mine: 'mining',
  herblore: 'herblore', herb: 'herblore',
  agility: 'agility', agil: 'agility',
  thieving: 'thieving', thiev: 'thieving', thief: 'thieving',
  slayer: 'slayer', slay: 'slayer',
  farming: 'farming', farm: 'farming',
  runecraft: 'runecraft', runecrafting: 'runecraft', rc: 'runecraft',
  hunter: 'hunter', hunt: 'hunter',
  construction: 'construction', con: 'construction', const: 'construction',
};

/**
 * Extract text from a table cell including image alt and title attributes.
 */
export function getFullCellText(cell: Element): string {
  if (!cell) return '';
  let text = cell.textContent || '';
  cell.querySelectorAll('[alt], [title]').forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.getAttribute('alt')) text += ' ' + htmlEl.getAttribute('alt');
    if (htmlEl.getAttribute('title')) text += ' ' + htmlEl.getAttribute('title');
  });
  return text;
}

/**
 * Parse skill requirements from an array of text snippets.
 *
 * This is the pure, DOM-free core of the requirement parser. Each snippet is
 * scanned for two patterns and matched against {@link SKILL_ALIASES}:
 *   - Pattern A: "90+ Ranged", "70+ Def", "99 Magic" (level then skill)
 *   - Pattern B: "Ranged 90+", "Def 70+" (skill then level)
 *
 * Only levels within the valid 1..99 range and words that map to a known skill
 * alias are kept. Results are deduplicated by (skill, level).
 *
 * The skill word is matched at a word boundary so that an alias which is only a
 * substring of a longer word is not matched (the greedy `[a-z]+` already
 * captures the full letter run, and the `\b` anchors make that explicit).
 */
export function parseRequirementsFromSnippets(snippets: string[]): SkillRequirement[] {
  const reqs: SkillRequirement[] = [];

  snippets.forEach((snippet) => {
    const norm = snippet.toLowerCase();

    // Pattern A: "90+ Ranged", "70+ Def", "99 Magic"
    const patternA = /(\d{1,2})\s*\+?\s*:?\s*\b([a-z]+)\b/g;
    // Pattern B: "Ranged 90+", "Def 70+"
    const patternB = /\b([a-z]+)\b\s*:?\s*(\d{1,2})\s*\+?/g;

    let match: RegExpExecArray | null;
    while ((match = patternA.exec(norm)) !== null) {
      const level = parseInt(match[1], 10);
      const word = match[2];
      if (SKILL_ALIASES[word] && level >= 1 && level <= 99) {
        const mappedSkill = SKILL_ALIASES[word];
        if (!reqs.some((r) => r.skill === mappedSkill && r.level === level)) {
          reqs.push({ skill: mappedSkill, level });
        }
      }
    }

    while ((match = patternB.exec(norm)) !== null) {
      const word = match[1];
      const level = parseInt(match[2], 10);
      if (SKILL_ALIASES[word] && level >= 1 && level <= 99) {
        const mappedSkill = SKILL_ALIASES[word];
        if (!reqs.some((r) => r.skill === mappedSkill && r.level === level)) {
          reqs.push({ skill: mappedSkill, level });
        }
      }
    }
  });

  return reqs;
}

/**
 * Parse skill requirements from a table cell element by element.
 * Returns an array of {skill, level} objects.
 */
export function parseCellRequirements(cell: Element): { skill: string; level: number }[] {
  if (!cell) return [];

  const subElements = cell.querySelectorAll('span, li, a, div, td');
  const snippets: string[] = [];

  if (subElements.length > 0) {
    subElements.forEach((el) => {
      if (el.children.length <= 3) {
        let snippetText = el.textContent || '';
        el.querySelectorAll('[alt], [title]').forEach((attrEl) => {
          const htmlEl = attrEl as HTMLElement;
          if (htmlEl.getAttribute('alt')) snippetText += ' ' + htmlEl.getAttribute('alt');
          if (htmlEl.getAttribute('title')) snippetText += ' ' + htmlEl.getAttribute('title');
        });
        snippets.push(snippetText);
      }
    });
  }

  // Fallback: full cell text
  snippets.push(getFullCellText(cell));

  return parseRequirementsFromSnippets(snippets);
}
