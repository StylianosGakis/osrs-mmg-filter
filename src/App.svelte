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
    hydrateFilters, mergeWarnings, clearAllFilters, excludeMethod,
  } from '$lib/stores.svelte';
  import { evaluateRow, passesNonFinancialCriteria } from '$lib/filterEngine';
  import { getFullCellText, parseCellRequirements } from '$lib/requirementParser';
  import { renderChipsForCell, getMethodName, getMethodPageTitle } from '$lib/chipRenderer';
  import { checkSubpageWarnings, purgeAndRefetch, onBackgroundMessage } from '$lib/messagebus';
  import { titleKey } from '$lib/titleKey';
  import type { RowData, RowVerdict, SubpageWarning, BackgroundMessage } from './types';

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

  // Sync lifecycle guards. Every sync run captures the generation counter at
  // start; any timer or background push that belongs to a superseded run is
  // ignored, so a stale watchdog or auto-hide can never clobber a newer sync.
  let syncGeneration = 0;
  let syncWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  let syncCompleteHideTimer: ReturnType<typeof setTimeout> | null = null;

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
  //
  // Filtering is split into two stages so the decision logic and the DOM
  // painting can change independently:
  //   evaluateRowVisibility() — reads the row and decides (no mutation)
  //   paintRow()              — renders chips, hide button, and visibility
  // applyFilters() just drives the loop and tallies counts.

  interface RowEval {
    row: HTMLElement;
    methodCell: HTMLTableCellElement;
    rowData: RowData;
    warning: SubpageWarning | null;
    verdict: RowVerdict;
  }

  /** Look up the warning/financial record for a page title via the canonical key. */
  function getWarning(pageTitle: string | null): SubpageWarning | null {
    if (!pageTitle) return null;
    return warningMap[titleKey(pageTitle)] ?? null;
  }

  /** Decide a row's visibility without touching the DOM. Returns null for non-data rows. */
  function evaluateRowVisibility(rowEl: HTMLTableRowElement): RowEval | null {
    const rowData = extractRowData(rowEl);
    if (!rowData) return null;
    const warning = getWarning(rowData.pageTitle);
    const verdict = evaluateRow(rowData, filters, warning);
    return {
      row: rowEl,
      methodCell: rowEl.cells[methodIndex] as HTMLTableCellElement,
      rowData,
      warning,
      verdict,
    };
  }

  /** Apply a row's decision to the DOM: chips, hide button, and visibility. */
  function paintRow(ev: RowEval): void {
    renderChipsForCell(ev.methodCell, ev.warning, financialState.isSyncing);
    injectHideButton(ev.methodCell, ev.rowData.methodName);

    // Visibility via row.style.display only (preserving native wiki table sorting)
    if (ev.verdict.visible) {
      ev.row.style.display = '';
    } else {
      if (ev.warning && ev.warning.finParsed) {
        // Keep a debug log so it's easy to see why strict filters hid a specific method
        console.debug(`[OSRS Filter Debug] Hidden "${ev.rowData.methodName}" because:`, ev.verdict.reasons);
      }
      ev.row.style.display = 'none';
    }
  }

  function applyFilters(): void {
    let visible = 0;
    let total = 0;

    table.querySelectorAll('tr').forEach((row: Element) => {
      const ev = evaluateRowVisibility(row as HTMLTableRowElement);
      if (!ev) return;
      total++;
      paintRow(ev);
      if (ev.verdict.visible) visible++;
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

  /** (Re)arm the stall watchdog for a specific sync generation. */
  function resetWatchdog(gen: number): void {
    if (syncWatchdogTimer) clearTimeout(syncWatchdogTimer);
    syncWatchdogTimer = setTimeout(() => {
      if (gen !== syncGeneration) return; // superseded by a newer sync
      if (syncProgress.syncing && !syncProgress.complete) {
        syncProgress.stalled = true;
      }
    }, 45_000);
  }

  /** Mark a sync generation complete and schedule the "synced" chip to auto-hide. */
  function markSyncComplete(gen: number, parsed: number): void {
    if (gen !== syncGeneration) return; // superseded
    syncProgress.parsed = parsed;
    syncProgress.syncing = false;
    syncProgress.complete = true;
    financialState.isSyncing = false;
    if (syncWatchdogTimer) {
      clearTimeout(syncWatchdogTimer);
      syncWatchdogTimer = null;
    }
    if (syncCompleteHideTimer) clearTimeout(syncCompleteHideTimer);
    syncCompleteHideTimer = setTimeout(() => {
      if (gen === syncGeneration) syncProgress.complete = false;
    }, 4000);
  }

  /**
   * Single entry point for both the initial load and a forced resync.
   * `mode` selects the request (fresh cache read vs purge-and-refetch) and
   * whether existing chips are cleared first.
   */
  async function runSync(mode: 'load' | 'resync'): Promise<void> {
    const candidates = getCandidateTitles();
    if (candidates.length === 0) return;

    const gen = ++syncGeneration;

    if (mode === 'resync') {
      // Clear cached warnings and chips for candidate rows before refetching
      table.querySelectorAll('tr').forEach((row: Element) => {
        const rowData = extractRowData(row as HTMLTableRowElement);
        if (rowData?.pageTitle && candidates.includes(rowData.pageTitle)) {
          delete warningMap[titleKey(rowData.pageTitle)];
          const cell = (row as HTMLTableRowElement).cells[methodIndex];
          const container = cell?.querySelector('.osrs-chip-container');
          if (container) container.replaceChildren();
        }
      });
    }

    financialState.hasLoaded = true;
    financialState.isSyncing = true;
    syncProgress.syncing = true;
    syncProgress.complete = false;
    syncProgress.stalled = false;
    syncProgress.parsed = 0;
    syncProgress.total = candidates.length;

    const result = mode === 'resync'
      ? await purgeAndRefetch(candidates)
      : await checkSubpageWarnings(candidates);

    // Warning data is safe to merge even if superseded (it is just cache data),
    // but progress/timer state must only advance for the current sync.
    mergeWarnings(result);
    if (gen !== syncGeneration) {
      applyFilters();
      return;
    }

    // Did the immediate response already contain everything we asked for?
    let completeCount = 0;
    candidates.forEach((c) => {
      const w = result[titleKey(c)];
      if (w && w.finParsed) completeCount++;
    });

    if (completeCount >= candidates.length) {
      markSyncComplete(gen, completeCount);
    } else {
      resetWatchdog(gen);
    }

    applyFilters();
  }

  function handleLoadData(): void {
    void runSync('load');
  }

  function handleResync(): void {
    void runSync('resync');
  }

  function handleClear(): void {
    clearAllFilters();
    applyFilters();
  }

  function handleRetrySync(): void {
    syncProgress.stalled = false;
    void runSync('resync');
  }

  // ─── Background Message Handler ────────────────────────────

  onBackgroundMessage((message: BackgroundMessage) => {
    if (message.action === 'warningsUpdated') {
      mergeWarnings(message.warningMap);
      applyFilters();

      // Only reflect progress while a sync is actually in flight. A push from a
      // finished or superseded sync still merges its data (harmless) but must
      // not revive or clobber the progress UI.
      if (!syncProgress.syncing) return;

      const gen = syncGeneration;
      syncProgress.parsed = message.parsedCount;
      syncProgress.total = message.totalTitles;

      if (message.isComplete || message.parsedCount >= message.totalTitles) {
        markSyncComplete(gen, message.parsedCount);
      } else {
        resetWatchdog(gen);
      }
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
