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
import { parseRequirementsFromSnippets, SKILL_ALIASES } from '../requirementParser';
import type { SkillRequirement } from '../../types';

describe('parseRequirementsFromSnippets - Pattern A (level then skill)', () => {
  it("parses '90+ Ranged'", () => {
    expect(parseRequirementsFromSnippets(['90+ Ranged'])).toEqual([{ skill: 'ranged', level: 90 }]);
  });

  it("parses '99 Magic'", () => {
    expect(parseRequirementsFromSnippets(['99 Magic'])).toEqual([{ skill: 'magic', level: 99 }]);
  });

  it("parses '70+ Def' via alias", () => {
    expect(parseRequirementsFromSnippets(['70+ Def'])).toEqual([{ skill: 'defence', level: 70 }]);
  });

  it("parses '85 rc' via alias", () => {
    expect(parseRequirementsFromSnippets(['85 rc'])).toEqual([{ skill: 'runecraft', level: 85 }]);
  });

  it("parses a colon separator '85: Magic'", () => {
    expect(parseRequirementsFromSnippets(['85: Magic'])).toEqual([{ skill: 'magic', level: 85 }]);
  });
});

describe('parseRequirementsFromSnippets - Pattern B (skill then level)', () => {
  it("parses 'Ranged 90+'", () => {
    expect(parseRequirementsFromSnippets(['Ranged 90+'])).toEqual([{ skill: 'ranged', level: 90 }]);
  });

  it("parses 'Def 70' via alias", () => {
    expect(parseRequirementsFromSnippets(['Def 70'])).toEqual([{ skill: 'defence', level: 70 }]);
  });
});

describe('parseRequirementsFromSnippets - dedupe', () => {
  it('dedupes identical (skill, level) across snippets', () => {
    expect(parseRequirementsFromSnippets(['90 Ranged', '90 Ranged'])).toEqual([
      { skill: 'ranged', level: 90 },
    ]);
  });

  it('dedupes within a single snippet', () => {
    expect(parseRequirementsFromSnippets(['90 Ranged 90 Ranged'])).toEqual([
      { skill: 'ranged', level: 90 },
    ]);
  });

  it('keeps distinct levels for the same skill', () => {
    expect(parseRequirementsFromSnippets(['80 Ranged', '90 Ranged'])).toEqual([
      { skill: 'ranged', level: 80 },
      { skill: 'ranged', level: 90 },
    ]);
  });
});

describe('parseRequirementsFromSnippets - alias mapping', () => {
  const cases: Array<[string, string]> = [
    ['atk', 'attack'],
    ['str', 'strength'],
    ['hp', 'hitpoints'],
    ['mage', 'magic'],
    ['wc', 'woodcutting'],
    ['fm', 'firemaking'],
    ['rc', 'runecraft'],
    ['con', 'construction'],
  ];

  it.each(cases)("maps alias '%s' to canonical skill '%s'", (alias, canonical) => {
    // Sanity check the alias table itself.
    expect(SKILL_ALIASES[alias]).toBe(canonical);
    expect(parseRequirementsFromSnippets([`50 ${alias}`])).toEqual([
      { skill: canonical, level: 50 },
    ]);
  });
});

describe('parseRequirementsFromSnippets - rejects non-skills', () => {
  it("rejects '5 coins'", () => {
    expect(parseRequirementsFromSnippets(['5 coins'])).toEqual([]);
  });

  it("rejects 'buy 40 planks' (planks is not a skill)", () => {
    expect(parseRequirementsFromSnippets(['buy 40 planks'])).toEqual([]);
  });

  it('returns [] for empty input', () => {
    expect(parseRequirementsFromSnippets([])).toEqual([]);
    expect(parseRequirementsFromSnippets([''])).toEqual([]);
  });
});

describe('parseRequirementsFromSnippets - level bounds and digit capture', () => {
  it("handles '150 magic' - regex captures only 1-2 digits", () => {
    // The regex captures at most two digits, so the leading "1" of "150" is
    // dropped and the parser reads "50 magic".
    expect(parseRequirementsFromSnippets(['150 magic'])).toEqual([{ skill: 'magic', level: 50 }]);
  });

  it('rejects level 0', () => {
    expect(parseRequirementsFromSnippets(['0 magic'])).toEqual([]);
  });

  it('accepts the boundary levels 1 and 99', () => {
    expect(parseRequirementsFromSnippets(['1 magic'])).toEqual([{ skill: 'magic', level: 1 }]);
    expect(parseRequirementsFromSnippets(['99 magic'])).toEqual([{ skill: 'magic', level: 99 }]);
  });
});

describe('parseRequirementsFromSnippets - multiple requirements', () => {
  it("parses '70 Agility' and '43 Prayer' from separate snippets", () => {
    expect(parseRequirementsFromSnippets(['70 Agility', '43 Prayer'])).toEqual([
      { skill: 'agility', level: 70 },
      { skill: 'prayer', level: 43 },
    ]);
  });

  it('parses multiple requirements from a single snippet', () => {
    const result: SkillRequirement[] = parseRequirementsFromSnippets(['70 Agility, 43 Prayer']);
    expect(result).toContainEqual({ skill: 'agility', level: 70 });
    expect(result).toContainEqual({ skill: 'prayer', level: 43 });
  });
});
