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


  import ActiveBadge from './ActiveBadge.svelte';
  import { filters, saveFilters, restoreMethod, syncProgress, statsState } from '$lib/stores.svelte';
  import { INTENSITY_LABELS, BUDGET_LABELS, ROI_LABELS } from '$lib/formatters';

  interface Props {
    visibleCount: number;
    totalCount: number;
    onRetrySync: () => void;
  }

  let { visibleCount, totalCount, onRetrySync }: Props = $props();

  let hasActiveFilters = $derived(
    filters.intensity !== 'none' ||
    filters.hideWilderness ||
    filters.hideRisky ||
    filters.maxBudget !== 'none' ||
    filters.minRoi !== 'none' ||
    filters.xpSkill !== 'all' ||
    filters.minXp !== 'none' ||
    (filters.playerStats !== null && filters.filterByStats && filters.rsn.trim() !== '') ||
    filters.excludedMethods.length > 0
  );

  let xpBadgeValue = $derived.by(() => {
    if (filters.xpSkill === 'all') return null;
    const skillLabel =
      filters.xpSkill === 'any' ? 'Any skill' :
      filters.xpSkill === 'combat' ? 'Combat' :
      filters.xpSkill.charAt(0).toUpperCase() + filters.xpSkill.slice(1);
    return filters.minXp !== 'none' ? `${skillLabel} ≥ ${filters.minXp}/hr` : skillLabel;
  });

  let countText = $derived.by(() => {
    if (totalCount <= 0) return 'Showing -- methods';
    if (visibleCount === totalCount) return `Showing all ${totalCount} methods`;
    return `Showing ${visibleCount} of ${totalCount} methods (${totalCount - visibleCount} hidden)`;
  });
</script>

<div class="osrs-filter-status-row">
  <div class="osrs-active-bar">
    <span class="osrs-count-chip">{countText}</span>

    <!-- Sync progress chip -->
    {#if syncProgress.stalled}
      <button
        class="osrs-loading-chip error"
        title="Click to force retry financial metrics sync"
        onclick={onRetrySync}
      >
        <svg width="12" height="12" viewBox="0 0 24 24">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        Sync stalled (click to retry)
      </button>
    {:else if syncProgress.complete}
      <span class="osrs-loading-chip synced">
        <svg width="12" height="12" viewBox="0 0 24 24">
          <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        Financials synced
      </span>
    {:else if syncProgress.syncing}
      <span class="osrs-loading-chip">
        <svg class="osrs-spinner-svg" width="11" height="11" viewBox="0 0 24 24">
          <path fill="currentColor" d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
        </svg>
        Syncing metrics ({syncProgress.parsed}/{syncProgress.total})...
      </span>
    {/if}

    <!-- Active filter badges -->
    <div class="osrs-active-badges">
      {#if filters.intensity !== 'none'}
        <ActiveBadge
          label="Intensity"
          value={INTENSITY_LABELS[filters.intensity] || filters.intensity}
          onremove={() => { filters.intensity = 'none'; saveFilters(); }}
        />
      {/if}

      {#if filters.hideWilderness}
        <ActiveBadge
          label="Risk"
          value="Hide Wilderness"
          onremove={() => { filters.hideWilderness = false; saveFilters(); }}
        />
      {/if}

      {#if filters.hideRisky}
        <ActiveBadge
          label="Risk"
          value="Hide Risky"
          onremove={() => { filters.hideRisky = false; saveFilters(); }}
        />
      {/if}


      {#if filters.maxBudget !== 'none'}
        <ActiveBadge
          label="Budget"
          value={BUDGET_LABELS[filters.maxBudget] || filters.maxBudget}
          onremove={() => { filters.maxBudget = 'none'; saveFilters(); }}
        />
      {/if}

      {#if filters.minRoi !== 'none'}
        <ActiveBadge
          label="Margin"
          value={ROI_LABELS[filters.minRoi] || filters.minRoi}
          onremove={() => { filters.minRoi = 'none'; saveFilters(); }}
        />
      {/if}

      {#if filters.playerStats && filters.filterByStats && filters.rsn}
        <ActiveBadge
          label="Stats"
          value={filters.rsn.trim()}
          onremove={() => {
            filters.playerStats = null;
            filters.rsn = '';
            statsState.status = '';
            statsState.isError = false;
            chrome?.storage?.local?.remove(['rsn', 'playerStats']);
            saveFilters();
          }}
        />
      {/if}

      {#if xpBadgeValue !== null}
        <ActiveBadge
          label="XP"
          value={xpBadgeValue}
          onremove={() => { filters.xpSkill = 'all'; filters.minXp = 'none'; saveFilters(); }}
        />
      {/if}
    </div>
  </div>

  <!-- Hidden Methods section -->
  {#if filters.excludedMethods.length > 0}
    <div class="osrs-excluded-section" style="display: flex;">
      <span class="osrs-section-label">Hidden Methods:</span>
      <div class="osrs-active-badges">
        {#each filters.excludedMethods as name (name)}
          <ActiveBadge
            label=""
            value={name}
            variant="excluded"
            onremove={() => restoreMethod(name)}
          />
        {/each}
      </div>
    </div>
  {/if}
</div>
