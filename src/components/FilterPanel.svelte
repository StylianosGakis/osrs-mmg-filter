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
  import CriteriaSection from './CriteriaSection.svelte';
  import RiskSection from './RiskSection.svelte';
  import ToolsSection from './ToolsSection.svelte';
  import StatusBar from './StatusBar.svelte';

  interface Props {
    visibleCount: number;
    totalCount: number;
    theme: 'light' | 'dark' | 'browntown';
    onLoadData: () => void;
    onResync: () => void;
    onClear: () => void;
    onRetrySync: () => void;
  }

  let { visibleCount, totalCount, theme, onLoadData, onResync, onClear, onRetrySync }: Props = $props();
</script>

<div class="osrs-filter-panel" data-theme={theme}>
  <!-- SECTION 1: METHOD CRITERIA (Intensity, Budget, Margin) -->
  <CriteriaSection />

  <!-- SECTION 2: EXCLUSIONS & RISK TOGGLES -->
  <RiskSection />

  <!-- SECTION 3: PLAYER PROFILE & UTILITY TOOLS -->
  <ToolsSection {onLoadData} {onResync} {onClear} />

  <!-- SECTION 4: ACTIVE BADGES & RESULTS BAR -->
  <StatusBar {visibleCount} {totalCount} {onRetrySync} />
</div>
