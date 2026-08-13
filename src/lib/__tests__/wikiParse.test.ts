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
  parseMmgFinancialsFromHtml,
  extractRiskFromParseData,
  extractXpGainedFromHtml,
  isVolumeApplicable,
} from '../wikiParse';
import type { ParseCategory, ParseTemplate } from '../wikiParse';
import type { XpGained } from '../../types';

// Fixtures are committed raw `action=parse` API responses. Import them as JSON
// modules (tsconfig has resolveJsonModule) so the tests need no Node fs/path types.
import castingSuperglassMake from './fixtures/casting-superglass-make.json';
import blastFurnace from './fixtures/blast-furnace.json';
import barrows from './fixtures/barrows.json';
import killingGreenDragons from './fixtures/killing-green-dragons.json';
import buyingBattlestaves from './fixtures/buying-battlestaves.json';

interface ParseFixture {
  parse: {
    title: string;
    text: { '*': string };
    categories?: ParseCategory[];
    templates?: ParseTemplate[];
  };
}

const FIXTURES: Record<string, ParseFixture> = {
  'casting-superglass-make': castingSuperglassMake as unknown as ParseFixture,
  'blast-furnace': blastFurnace as unknown as ParseFixture,
  'barrows': barrows as unknown as ParseFixture,
  'killing-green-dragons': killingGreenDragons as unknown as ParseFixture,
  'buying-battlestaves': buyingBattlestaves as unknown as ParseFixture,
};

function loadFixture(name: string) {
  const p = FIXTURES[name].parse;
  return {
    html: p.text['*'],
    categories: p.categories || [],
    templates: p.templates || [],
    title: p.title,
  };
}

const volMap: Record<string, number> = {
  'molten glass': 500000,
  battlestaff: 40000,
  'air battlestaff': 15000,
};

/** Compare XP arrays as order-independent sets keyed by skill. */
function sortXp(xp: XpGained[]): XpGained[] {
  return [...xp].sort((a, b) => a.skill.localeCompare(b.skill));
}

describe('parseMmgFinancialsFromHtml (fixtures)', () => {
  it('casting-superglass-make: processing method with output volume', () => {
    const f = loadFixture('casting-superglass-make');
    const fin = parseMmgFinancialsFromHtml(f.html, volMap, f.title, f.categories);
    expect(fin).toEqual({
      inputCost: 315600,
      grossOutput: 1346760,
      roi: 327,
      outputVolume: 500000,
    });
  });

  it('blast-furnace: disambiguation page with no MMG markup', () => {
    const f = loadFixture('blast-furnace');
    const fin = parseMmgFinancialsFromHtml(f.html, volMap, f.title, f.categories);
    expect(fin).toEqual({
      inputCost: 0,
      grossOutput: 0,
      roi: 99999,
      outputVolume: 0,
    });
  });

  it('barrows: combat method has no applicable output volume', () => {
    const f = loadFixture('barrows');
    const fin = parseMmgFinancialsFromHtml(f.html, volMap, f.title, f.categories);
    expect(fin).toEqual({
      inputCost: 297293,
      grossOutput: 1062204,
      roi: 257,
      outputVolume: 0,
    });
  });

  it('killing-green-dragons: wilderness method has no applicable output volume', () => {
    const f = loadFixture('killing-green-dragons');
    const fin = parseMmgFinancialsFromHtml(f.html, volMap, f.title, f.categories);
    expect(fin).toEqual({
      inputCost: 91854,
      grossOutput: 931558,
      roi: 914,
      outputVolume: 0,
    });
  });

  it('buying-battlestaves: buying method with output volume', () => {
    const f = loadFixture('buying-battlestaves');
    const fin = parseMmgFinancialsFromHtml(f.html, volMap, f.title, f.categories);
    expect(fin).toEqual({
      inputCost: 840000,
      grossOutput: 868440,
      roi: 3,
      outputVolume: 40000,
    });
  });
});

describe('extractRiskFromParseData (fixtures)', () => {
  it('casting-superglass-make: no risk', () => {
    const f = loadFixture('casting-superglass-make');
    expect(extractRiskFromParseData(f.html, f.categories, f.templates)).toEqual({
      hasWildernessWarning: false,
      hasWarning: false,
    });
  });

  it('blast-furnace: no risk', () => {
    const f = loadFixture('blast-furnace');
    expect(extractRiskFromParseData(f.html, f.categories, f.templates)).toEqual({
      hasWildernessWarning: false,
      hasWarning: false,
    });
  });

  it('barrows: no risk', () => {
    const f = loadFixture('barrows');
    expect(extractRiskFromParseData(f.html, f.categories, f.templates)).toEqual({
      hasWildernessWarning: false,
      hasWarning: false,
    });
  });

  it('killing-green-dragons: wilderness and warning', () => {
    const f = loadFixture('killing-green-dragons');
    expect(extractRiskFromParseData(f.html, f.categories, f.templates)).toEqual({
      hasWildernessWarning: true,
      hasWarning: true,
    });
  });

  it('buying-battlestaves: no risk', () => {
    const f = loadFixture('buying-battlestaves');
    expect(extractRiskFromParseData(f.html, f.categories, f.templates)).toEqual({
      hasWildernessWarning: false,
      hasWarning: false,
    });
  });
});

describe('extractXpGainedFromHtml (fixtures)', () => {
  it('casting-superglass-make: Magic and Crafting XP', () => {
    const f = loadFixture('casting-superglass-make');
    const xp = extractXpGainedFromHtml(f.html);
    expect(sortXp(xp)).toEqual(
      sortXp([
        { skill: 'Magic', xp: 46800 },
        { skill: 'Crafting', xp: 108000 },
      ])
    );
  });

  it('blast-furnace: no XP', () => {
    const f = loadFixture('blast-furnace');
    expect(extractXpGainedFromHtml(f.html)).toEqual([]);
  });

  it('barrows: no XP', () => {
    const f = loadFixture('barrows');
    expect(extractXpGainedFromHtml(f.html)).toEqual([]);
  });

  it('killing-green-dragons: Combat level and Hitpoints XP', () => {
    const f = loadFixture('killing-green-dragons');
    const xp = extractXpGainedFromHtml(f.html);
    expect(sortXp(xp)).toEqual(
      sortXp([
        { skill: 'Combat level', xp: 54000 },
        { skill: 'Hitpoints', xp: 18000 },
      ])
    );
  });

  it('buying-battlestaves: no XP', () => {
    const f = loadFixture('buying-battlestaves');
    expect(extractXpGainedFromHtml(f.html)).toEqual([]);
  });
});

describe('parseMmgFinancialsFromHtml (unit)', () => {
  it('returns defaults for empty html', () => {
    expect(parseMmgFinancialsFromHtml('')).toEqual({
      inputCost: 0,
      grossOutput: 0,
      roi: 99999,
      outputVolume: 0,
    });
  });
});

describe('extractXpGainedFromHtml (unit)', () => {
  it('returns empty array for empty html', () => {
    expect(extractXpGainedFromHtml('')).toEqual([]);
  });
});

describe('extractRiskFromParseData (unit)', () => {
  it('category "*" containing MMG/Risky sets hasWarning', () => {
    const categories: ParseCategory[] = [{ '*': 'MMG/Risky' }];
    expect(extractRiskFromParseData('', categories, [])).toEqual({
      hasWildernessWarning: false,
      hasWarning: true,
    });
  });

  it('category "*" containing Wilderness sets both flags', () => {
    const categories: ParseCategory[] = [{ '*': 'MMG/Wilderness' }];
    expect(extractRiskFromParseData('', categories, [])).toEqual({
      hasWildernessWarning: true,
      hasWarning: true,
    });
  });

  it('template title containing wilderness sets both flags', () => {
    expect(extractRiskFromParseData('', [], [{ title: 'Template:Wilderness warning' }])).toEqual({
      hasWildernessWarning: true,
      hasWarning: true,
    });
  });

  it('template title containing ambox sets hasWarning only', () => {
    expect(extractRiskFromParseData('', [], [{ title: 'Template:Ambox' }])).toEqual({
      hasWildernessWarning: false,
      hasWarning: true,
    });
  });

  it('template title containing warning sets hasWarning only', () => {
    expect(extractRiskFromParseData('', [], [{ title: 'Template:MMG warning' }])).toEqual({
      hasWildernessWarning: false,
      hasWarning: true,
    });
  });

  it('wilderness keyword with a risk-signal word sets both flags', () => {
    const html = '<p>This is in the Wilderness, high risk of being pked</p>';
    expect(extractRiskFromParseData(html, [], [])).toEqual({
      hasWildernessWarning: true,
      hasWarning: true,
    });
  });

  it('wilderness boss name alone (no risk-signal word) does not flag', () => {
    // "scorpia" is a wilderness core keyword, but with no warning/notice/danger/
    // risk/wilderness signal word present the co-occurrence gate must not fire.
    const html = '<p>Scorpia is a large spider found deep underground.</p>';
    expect(extractRiskFromParseData(html, [], [])).toEqual({
      hasWildernessWarning: false,
      hasWarning: false,
    });
  });
});

describe('isVolumeApplicable', () => {
  it('returns false for combat titles', () => {
    expect(isVolumeApplicable('Money making guide/Killing green dragons', [], 1)).toBe(false);
  });

  it('returns true for a processing title with one output item', () => {
    expect(isVolumeApplicable('Money making guide/Casting Superglass Make', [], 1)).toBe(true);
  });

  it('returns false when output item count is 0', () => {
    expect(isVolumeApplicable('Money making guide/Casting Superglass Make', [], 0)).toBe(false);
  });

  it('returns false when output item count exceeds 2', () => {
    expect(isVolumeApplicable('Money making guide/Casting Superglass Make', [], 3)).toBe(false);
  });
});
