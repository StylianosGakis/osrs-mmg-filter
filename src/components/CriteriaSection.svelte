<script lang="ts">
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


  import SegmentedControl from './SegmentedControl.svelte';
  import { filters, saveFilters } from '$lib/stores.svelte';
  import type { IntensityFilter, BudgetFilter, RoiFilter, XpSkillFilter, MinXpFilter } from '../types';

  const intensityOptions = [
    { value: 'none', label: 'All', title: 'Show methods of any intensity level' },
    { value: 'low', label: 'Low', dotColor: 'green', title: 'Show only Low effort / AFK methods' },
    { value: 'moderate', label: 'Mod ≤', dotColor: 'amber', title: 'Show Moderate or Low effort methods' },
    { value: 'high', label: 'High', dotColor: 'red', title: 'Show High intensity / click-heavy methods' }
  ];

  const budgetOptions = [
    { value: 'none', label: 'All', title: 'Show methods requiring any upfront budget' },
    { value: '100k', label: '<100k', title: 'Max 100,000 GP hourly supply input cost' },
    { value: '1m', label: '<1M', title: 'Max 1,000,000 GP hourly supply input cost' },
    { value: '5m', label: '<5M', title: 'Max 5,000,000 GP hourly supply input cost' },
    { value: '10m', label: '<10M', title: 'Max 10,000,000 GP hourly supply input cost' }
  ];

  const marginOptions = [
    { value: 'none', label: 'All', title: 'Show methods with any profit margin' },
    { value: '15', label: '>15% ROI', title: 'Require at least 15% Return on Investment (Profit ÷ Supply Cost)' },
    { value: '50', label: '>50% ROI', title: 'Require high margin (>50% Return on Investment)' }
  ];

  const minXpOptions = [
    { value: 'none', label: 'Any XP', title: 'Include methods granting any amount of XP' },
    { value: '10k', label: '>10k/hr', title: 'Require at least 10,000 XP/hr' },
    { value: '25k', label: '>25k/hr', title: 'Require at least 25,000 XP/hr' },
    { value: '50k', label: '>50k/hr', title: 'Require at least 50,000 XP/hr' },
    { value: '100k', label: '>100k/hr', title: 'Require at least 100,000 XP/hr' }
  ];

  const skillList = [
    { value: 'all', label: 'All Skills' },
    { value: 'any', label: 'Any (Grants XP)' },
    { value: 'combat', label: 'Combat Skills' },
    { value: 'Agility', label: 'Agility' },
    { value: 'Construction', label: 'Construction' },
    { value: 'Cooking', label: 'Cooking' },
    { value: 'Crafting', label: 'Crafting' },
    { value: 'Farming', label: 'Farming' },
    { value: 'Fishing', label: 'Fishing' },
    { value: 'Fletching', label: 'Fletching' },
    { value: 'Herblore', label: 'Herblore' },
    { value: 'Hunter', label: 'Hunter' },
    { value: 'Magic', label: 'Magic' },
    { value: 'Mining', label: 'Mining' },
    { value: 'Prayer', label: 'Prayer' },
    { value: 'Runecraft', label: 'Runecraft' },
    { value: 'Slayer', label: 'Slayer' },
    { value: 'Smithing', label: 'Smithing' },
    { value: 'Thieving', label: 'Thieving' },
    { value: 'Woodcutting', label: 'Woodcutting' }
  ];

  function handleIntensityChange(val: string) {
    filters.intensity = val as IntensityFilter;
    saveFilters();
  }

  function handleBudgetChange(val: string) {
    filters.maxBudget = val as BudgetFilter;
    saveFilters();
  }

  function handleMarginChange(val: string) {
    filters.minRoi = val as RoiFilter;
    saveFilters();
  }

  function handleXpSkillChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    filters.xpSkill = target.value as XpSkillFilter;
    saveFilters();
  }

  function handleMinXpChange(val: string) {
    filters.minXp = val as MinXpFilter;
    saveFilters();
  }
</script>

<div class="osrs-filter-section osrs-criteria-section">
  <div class="osrs-filter-group">
    <span class="osrs-filter-label" title="Filter by mechanical effort/attention level required (Low = AFK, High = intensive clicks)">Intensity:</span>
    <SegmentedControl
      options={intensityOptions}
      bind:value={filters.intensity}
      onchange={handleIntensityChange}
    />
  </div>

  <div class="osrs-filter-group">
    <span class="osrs-filter-label" title="Filter by maximum hourly supply input cost (upfront GP capital required per hour)">Max Budget:</span>
    <SegmentedControl
      options={budgetOptions}
      bind:value={filters.maxBudget}
      onchange={handleBudgetChange}
    />
  </div>

  <div class="osrs-filter-group">
    <span class="osrs-filter-label" title="Filter by Return on Investment percentage (Profit ÷ Supply Input Cost)">Min Margin:</span>
    <SegmentedControl
      options={marginOptions}
      bind:value={filters.minRoi}
      onchange={handleMarginChange}
    />
  </div>

  <div class="osrs-filter-group">
    <span class="osrs-filter-label" title="Filter methods by the specific skill experience granted">Skill XP:</span>
    <select
      class="osrs-filter-select osrs-xp-select"
      title="Select skill to filter by experience gained"
      value={filters.xpSkill}
      onchange={handleXpSkillChange}
    >
      {#each skillList as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>

  {#if filters.xpSkill !== 'all'}
    <div class="osrs-filter-group">
      <span class="osrs-filter-label" title="Filter by minimum skill experience points gained per hour">Min XP/hr:</span>
      <SegmentedControl
        options={minXpOptions}
        bind:value={filters.minXp}
        onchange={handleMinXpChange}
      />
    </div>
  {/if}
</div>
