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


  import FilterPanel from './components/FilterPanel.svelte';
  import {
    filters, warningMap, syncProgress, financialState,
    saveFilters, hydrateFilters, mergeWarnings, clearAllFilters, excludeMethod,
  } from '$lib/stores.svelte';
  import { evaluateRow, passesNonFinancialCriteria } from '$lib/filterEngine';
  import { getFullCellText, parseCellRequirements } from '$lib/requirementParser';
  import { renderChipsForCell, getMethodName, getMethodPageTitle } from '$lib/chipRenderer';
  import { checkSubpageWarnings, purgeAndRefetch, onBackgroundMessage } from '$lib/messagebus';
  import type { RowData, BackgroundMessage } from './types';

  // ─── Wiki Table Reference ──────────────────────────────────
  interface Props {
    table: HTMLTableElement;
    methodIndex: number;
    intensityIndex: number;
    reqIndex: number;
    skillsIndex: number;
    categoryIndex: number;
  }

  let { table, methodIndex, intensityIndex, reqIndex, skillsIndex, categoryIndex }: Props = $props();

  let visibleCount = $state(0);
  let totalCount = $state(0);
  let syncWatchdogTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Theme Detection ───────────────────────────────────────
  // Detect the wiki's active theme from body classes (outside Shadow DOM)
  let theme = $state<'light' | 'dark' | 'browntown'>('light');

  function detectTheme(): void {
    const body = document.body;
    if (body.classList.contains('wgl-theme-dark') || body.classList.contains('wgl-darkmode')) {
      theme = 'dark';
    } else if (body.classList.contains('wgl-theme-browntown') || body.classList.contains('wgl-browntownmode')) {
      theme = 'browntown';
    } else {
      theme = 'light';
    }
  }

  // Detect initial theme and watch for changes
  detectTheme();
  const themeObserver = new MutationObserver(detectTheme);
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // ─── Row Data Extraction ───────────────────────────────────

  function extractRowData(row: HTMLTableRowElement): RowData | null {
    if (row.querySelector('th') || row.parentElement?.tagName === 'THEAD') return null;
    const cells = row.cells;
    if (!cells || cells.length <= Math.max(methodIndex, intensityIndex)) return null;

    const methodCell = cells[methodIndex];
    const methodName = getMethodName(methodCell);
    const pageTitle = getMethodPageTitle(methodCell);
    const intensityText = cells[intensityIndex]
      ? getFullCellText(cells[intensityIndex]).trim().toLowerCase()
      : '';

    const requirementText = reqIndex !== -1 && cells[reqIndex]
      ? getFullCellText(cells[reqIndex]).toLowerCase()
      : '';
    const categoryText = categoryIndex !== -1 && cells[categoryIndex]
      ? getFullCellText(cells[categoryIndex]).toLowerCase()
      : '';

    // Parse requirements from all relevant cells
    const parsedRequirements: { skill: string; level: number }[] = [];
    if (reqIndex !== -1 && cells[reqIndex]) {
      parsedRequirements.push(...parseCellRequirements(cells[reqIndex]));
    }
    if (skillsIndex !== -1 && cells[skillsIndex]) {
      parsedRequirements.push(...parseCellRequirements(cells[skillsIndex]));
    }
    if (reqIndex === -1 && skillsIndex === -1) {
      Array.from(cells).forEach((cell, idx) => {
        if (idx !== methodIndex && idx !== intensityIndex) {
          parsedRequirements.push(...parseCellRequirements(cell));
        }
      });
    }

    return {
      methodName,
      pageTitle,
      intensityText,
      requirementText,
      categoryText,
      parsedRequirements,
    };
  }

  // ─── Filter Application ────────────────────────────────────

  function applyFilters(): void {
    const rows = table.querySelectorAll('tr');
    let visible = 0;
    let total = 0;

    rows.forEach((row: Element) => {
      const rowData = extractRowData(row as HTMLTableRowElement);
      if (!rowData) return;

      total++;

      const warning = rowData.pageTitle
        ? warningMap[rowData.pageTitle] || warningMap[rowData.pageTitle.toLowerCase()]
        : null;

      const verdict = evaluateRow(rowData, filters, warning);
      const methodCell = (row as HTMLTableRowElement).cells[methodIndex];

      // Render chips
      renderChipsForCell(
        methodCell as HTMLTableCellElement,
        warning,
        financialState.isSyncing
      );

      // Inject hide button
      injectHideButton(methodCell as HTMLTableCellElement, rowData.methodName);

      // Apply visibility via row.style.display (preserving native wiki table sorting)
      if (verdict.visible) {
        (row as HTMLElement).style.display = '';
        visible++;
      } else {
        if (warning && warning.finParsed) {
          // Keep a debug log so it's easy to see why strict filters hid a specific method
          console.debug(`[OSRS Filter Debug] Hidden "${rowData.methodName}" because:`, verdict.reasons);
        }
        (row as HTMLElement).style.display = 'none';
      }
    });

    visibleCount = visible;
    totalCount = total;
  }

  // ─── Hide Buttons ──────────────────────────────────────────

  function injectHideButton(methodCell: HTMLTableCellElement, methodName: string): void {
    if (methodCell.querySelector('.osrs-row-hide-btn')) return;

    const hideBtn = document.createElement('button');
    hideBtn.type = 'button';
    hideBtn.className = 'osrs-row-hide-btn';
    hideBtn.title = 'Exclude this method';
    hideBtn.innerHTML = '&times;';

    hideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (methodName) {
        excludeMethod(methodName);
        applyFilters();
      }
    });

    methodCell.insertBefore(hideBtn, methodCell.firstChild);
  }

  // ─── Candidate Titles ──────────────────────────────────────

  function getCandidateTitles(): string[] {
    const titles: string[] = [];
    table.querySelectorAll('tr').forEach((row: Element) => {
      const rowData = extractRowData(row as HTMLTableRowElement);
      if (!rowData?.pageTitle) return;
      if (passesNonFinancialCriteria(rowData, filters)) {
        titles.push(rowData.pageTitle);
      }
    });
    return titles;
  }

  // ─── Financial Loading ─────────────────────────────────────

  function resetWatchdog(): void {
    if (syncWatchdogTimer) clearTimeout(syncWatchdogTimer);
    syncWatchdogTimer = setTimeout(() => {
      if (syncProgress.syncing && !syncProgress.complete) {
        syncProgress.stalled = true;
      }
    }, 45_000);
  }

  async function handleLoadData(): Promise<void> {
    const candidates = getCandidateTitles();
    if (candidates.length === 0) return;

    financialState.hasLoaded = true;
    financialState.isSyncing = true;
    syncProgress.syncing = true;
    syncProgress.complete = false;
    syncProgress.stalled = false;
    syncProgress.parsed = 0;
    syncProgress.total = candidates.length;

    const result = await checkSubpageWarnings(candidates);
    mergeWarnings(result);
    
    // Check if the initial response already contains all the parsed data we need
    let completeCount = 0;
    candidates.forEach(c => {
      const w = result[c] || result[c.toLowerCase()];
      if (w && w.finParsed) completeCount++;
    });
    
    if (completeCount >= candidates.length) {
      syncProgress.parsed = completeCount;
      syncProgress.syncing = false;
      syncProgress.complete = true;
      financialState.isSyncing = false;
      setTimeout(() => {
        syncProgress.complete = false;
      }, 4000);
      if (syncWatchdogTimer) {
        clearTimeout(syncWatchdogTimer);
        syncWatchdogTimer = null;
      }
    } else {
      resetWatchdog();
    }
    
    applyFilters();
  }

  async function handleResync(): Promise<void> {
    const candidates = getCandidateTitles();
    if (candidates.length === 0) return;

    // Clear chips from candidate rows
    table.querySelectorAll('tr').forEach((row: Element) => {
      const rowData = extractRowData(row as HTMLTableRowElement);
      if (rowData?.pageTitle && candidates.includes(rowData.pageTitle)) {
        delete warningMap[rowData.pageTitle];
        delete warningMap[rowData.pageTitle.toLowerCase()];
        const cell = (row as HTMLTableRowElement).cells[methodIndex];
        const container = cell?.querySelector('.osrs-chip-container');
        if (container) container.replaceChildren();
      }
    });

    financialState.hasLoaded = true;
    financialState.isSyncing = true;
    syncProgress.syncing = true;
    syncProgress.complete = false;
    syncProgress.stalled = false;
    syncProgress.parsed = 0;
    syncProgress.total = candidates.length;

    const result = await purgeAndRefetch(candidates);
    mergeWarnings(result);
    
    // Check if the initial response already contains all the parsed data we need
    let completeCount = 0;
    candidates.forEach(c => {
      const w = result[c] || result[c.toLowerCase()];
      if (w && w.finParsed) completeCount++;
    });
    
    if (completeCount >= candidates.length) {
      syncProgress.parsed = completeCount;
      syncProgress.syncing = false;
      syncProgress.complete = true;
      financialState.isSyncing = false;
      setTimeout(() => {
        syncProgress.complete = false;
      }, 4000);
      if (syncWatchdogTimer) {
        clearTimeout(syncWatchdogTimer);
        syncWatchdogTimer = null;
      }
    } else {
      resetWatchdog();
    }
    
    applyFilters();
  }

  function handleClear(): void {
    clearAllFilters();
    applyFilters();
  }

  function handleRetrySync(): void {
    syncProgress.stalled = false;
    handleResync();
  }

  // ─── Background Message Handler ────────────────────────────

  onBackgroundMessage((message: BackgroundMessage) => {
    if (message.action === 'warningsUpdated') {
      mergeWarnings(message.warningMap);
      resetWatchdog();

      syncProgress.parsed = message.parsedCount;
      syncProgress.total = message.totalTitles;

      if (message.isComplete || (message.parsedCount >= message.totalTitles)) {
        if (syncWatchdogTimer) clearTimeout(syncWatchdogTimer);
        syncProgress.syncing = false;
        syncProgress.complete = true;
        financialState.isSyncing = false;

        // Auto-hide synced chip after 4 seconds
        setTimeout(() => {
          syncProgress.complete = false;
        }, 4000);
      }

      applyFilters();
    } else if (message.action === 'syncLog') {
      const prefix = '[OSRS Filter Background]';
      const logMsg = message.message || '';
      const logDetails = message.details || '';
      if (message.level === 'warn') console.warn(prefix, logMsg, logDetails);
      else if (message.level === 'error') console.error(prefix, logMsg, logDetails);
      else console.log(prefix, logMsg, logDetails);
    }
  });

  // ─── Initialization ────────────────────────────────────────

  // Hydrate stored state and apply initial filters
  hydrateFilters().then(() => {
    applyFilters();
  });

  // Re-apply filters reactively when filter state changes
  $effect(() => {
    // Touch all filter values to subscribe to them
    void filters.intensity;
    void filters.hideWilderness;
    void filters.hideRisky;
    void filters.maxBudget;
    void filters.minRoi;
    void filters.xpSkill;
    void filters.minXp;
    void filters.excludedMethods;
    void filters.filterByStats;
    void filters.playerStats;

    applyFilters();
  });
</script>

<FilterPanel
  {visibleCount}
  {totalCount}
  {theme}
  onLoadData={handleLoadData}
  onResync={handleResync}
  onClear={handleClear}
  onRetrySync={handleRetrySync}
/>
