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


  import { filters, saveFilters, statsState, financialState, syncProgress } from '$lib/stores.svelte';
  import { fetchPlayerStats } from '$lib/messagebus';

  let isLooking = $state(false);

  async function doLookup() {
    const username = filters.rsn.trim();
    if (!username) {
      statsState.status = 'Please enter an in-game username.';
      statsState.isError = true;
      return;
    }

    isLooking = true;
    statsState.status = 'Fetching stats from Hiscores...';
    statsState.isError = false;

    const stats = await fetchPlayerStats(username);
    isLooking = false;

    if (stats) {
      filters.playerStats = stats;
      statsState.status = `Stats synced for "${username}"`;
      statsState.isError = false;
      saveFilters();
    } else {
      statsState.status = `Could not find stats for "${username}".`;
      statsState.isError = true;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') doLookup();
  }

  interface Props {
    onLoadData: () => void;
    onResync: () => void;
    onClear: () => void;
  }

  let { onLoadData, onResync, onClear }: Props = $props();
</script>

<div class="osrs-filter-section osrs-tools-section">
  <div class="osrs-tools-left">
    <div class="osrs-filter-group">
      <label class="osrs-filter-label" for="osrs-username-input">RSN:</label>
      <div class="osrs-input-wrapper">
        <svg class="osrs-input-icon" viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
        <input
          type="text"
          id="osrs-username-input"
          class="osrs-filter-input osrs-filter-rsn"
          placeholder="In-game name..."
          bind:value={filters.rsn}
          onkeydown={handleKeydown}
        />
      </div>
      <button
        type="button"
        class="osrs-filter-btn-lookup"
        disabled={isLooking}
        onclick={doLookup}
      >
        {isLooking ? 'Looking up...' : 'Lookup'}
      </button>
    </div>

    <div class="osrs-filter-group">
      <label class="osrs-filter-checkbox-label" title="Hide methods where your character doesn't meet the skill level requirements">
        <input
          type="checkbox"
          id="osrs-stats-toggle"
          bind:checked={filters.filterByStats}
          onchange={saveFilters}
        />
        Filter by stats
      </label>
    </div>

    {#if statsState.status}
      <div class="osrs-stats-status active" class:error={statsState.isError}>
        {#if !statsState.isError && filters.playerStats && filters.rsn}
          <span class="osrs-rsn-chip">
            <svg width="12" height="12" viewBox="0 0 24 24">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            {statsState.status}
          </span>
        {:else}
          {statsState.status}
        {/if}
      </div>
    {/if}
  </div>

  <div class="osrs-tools-right">
    {#if financialState.hasLoaded}
      <button
        type="button"
        class="osrs-filter-btn-refresh osrs-btn-resync"
        title="Purge cache and re-fetch financial metrics live from the OSRS Wiki"
        onclick={onResync}
      >
        <svg class="osrs-refresh-icon" width="13" height="13" viewBox="0 0 24 24">
          <path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
        </svg>
        <span class="osrs-btn-text">Resync Financials</span>
      </button>
    {:else}
      <button
        type="button"
        class="osrs-filter-btn-refresh osrs-btn-load"
        title="Load financial metrics and risk warnings for money making methods"
        onclick={onLoadData}
      >
        <svg class="osrs-refresh-icon" width="13" height="13" viewBox="0 0 24 24">
          <path fill="currentColor" d="M12 4v12l-4-4-1.41 1.41L12 18.83l5.41-5.42L16 12l-4 4V4zM5 20h14v-2H5v2z"/>
        </svg>
        <span class="osrs-btn-text">Load Data</span>
      </button>
    {/if}

    <button type="button" class="osrs-filter-btn-clear" onclick={onClear}>
      Clear Filters
    </button>
  </div>
</div>
