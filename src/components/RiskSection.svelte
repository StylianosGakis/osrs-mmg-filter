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
<script lang="ts">
  import ToggleChip from './ToggleChip.svelte';
  import { filters, saveFilters } from '$lib/stores.svelte';

  function toggleWilderness() {
    filters.hideWilderness = !filters.hideWilderness;
    saveFilters();
  }

  function toggleRisky() {
    filters.hideRisky = !filters.hideRisky;
    saveFilters();
  }
</script>

<div class="osrs-filter-section osrs-risk-section">
  <span class="osrs-filter-label">Hide Risks:</span>
  <div class="osrs-chip-toggle-group">
    <ToggleChip
      bind:active={filters.hideWilderness}
      title="Hide methods requiring entry into Wilderness or PvP areas"
      icon="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
      ontoggle={toggleWilderness}
    >
      Wilderness / PvP
    </ToggleChip>
    <ToggleChip
      bind:active={filters.hideRisky}
      title="Hide methods with warning notices (unstable prices, low volume, slow GE resale)"
      icon="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"
      ontoggle={toggleRisky}
    >
      Risky / Volatile
    </ToggleChip>
  </div>
</div>
