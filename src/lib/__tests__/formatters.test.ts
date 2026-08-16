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
import { formatGp, formatXp, formatVolume } from '../formatters';

describe('formatGp', () => {
  it('formats zero / invalid as "0 GP"', () => {
    expect(formatGp(0)).toBe('0 GP');
    expect(formatGp(NaN)).toBe('0 GP');
    expect(formatGp(-5)).toBe('0 GP');
  });

  it('formats sub-thousand values with a plain number', () => {
    expect(formatGp(750)).toBe('750 GP');
  });

  it('formats thousands with a k suffix', () => {
    expect(formatGp(195_000)).toBe('195k GP');
    expect(formatGp(194_667)).toBe('195k GP');
  });

  it('formats millions with an M suffix', () => {
    expect(formatGp(1_000_000)).toBe('1M GP');
    expect(formatGp(3_805_504)).toBe('3.8M GP');
  });

  it('promotes near-1M values to M instead of showing "1000k"', () => {
    expect(formatGp(999_750)).toBe('1M GP');
    expect(formatGp(999_999)).toBe('1M GP');
  });
});

describe('formatXp', () => {
  it('formats zero / invalid as "0 XP"', () => {
    expect(formatXp(0)).toBe('0 XP');
    expect(formatXp(NaN)).toBe('0 XP');
  });

  it('formats thousands and millions', () => {
    expect(formatXp(129_600)).toBe('129.6k XP');
    expect(formatXp(1_200_000)).toBe('1.2M XP');
    expect(formatXp(1_000_000)).toBe('1M XP');
  });

  it('promotes near-1M values to M instead of showing "1000k"', () => {
    expect(formatXp(999_960)).toBe('1M XP');
  });
});

describe('formatVolume', () => {
  it('formats per-day trade volume', () => {
    expect(formatVolume(500)).toBe('500/d');
    expect(formatVolume(25_000)).toBe('25k/d');
    expect(formatVolume(1_500_000)).toBe('1.5M/d');
  });

  it('promotes near-1M values to M instead of showing "1000k/d"', () => {
    expect(formatVolume(999_600)).toBe('1.0M/d');
  });
});
