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
/**
 * Content Script Entry Point
 *
 * Finds the primary MMG table on the OSRS Wiki, creates a Shadow DOM host,
 * injects styles, and mounts the Svelte filter panel.
 */

import { mount } from 'svelte';
import App from './App.svelte';
import panelCss from './panel.css?inline';
import { getFullCellText } from '$lib/requirementParser';

function init(): void {
  // Prevent double-initialization
  if (document.querySelector('#osrs-filter-host')) return;

  console.log('[OSRS Filter] Initializing Svelte Content Script...');

  // Step A: Find the primary Money Making table with Intensity column
  const tables = document.querySelectorAll('table.wikitable');
  let table: HTMLTableElement | null = null;

  for (const t of tables) {
    const headerRow = t.querySelector('tr');
    if (headerRow) {
      const text = getFullCellText(headerRow).toLowerCase();
      if (text.includes('method') && text.includes('intensity')) {
        table = t as HTMLTableElement;
        break;
      }
    }
  }

  if (!table) {
    table = document.querySelector('table.wikitable') as HTMLTableElement | null;
  }

  if (!table) {
    console.warn('[OSRS Filter] Table table.wikitable not found!');
    return;
  }

  // Step B: Dynamic Column Mapping
  const headers = table.querySelectorAll('th');
  let methodIndex = -1;
  let intensityIndex = -1;
  let reqIndex = -1;
  let skillsIndex = -1;
  let categoryIndex = -1;

  headers.forEach((th, index) => {
    const text = getFullCellText(th).trim().toLowerCase();
    if (text.includes('method')) {
      methodIndex = index;
    } else if (text.includes('intensity')) {
      intensityIndex = index;
    } else if (text.includes('req') || text.includes('detail') || text.includes('level')) {
      reqIndex = index;
    } else if (text.includes('skill')) {
      skillsIndex = index;
    } else if (text.includes('category') || text.includes('type')) {
      categoryIndex = index;
    }
  });

  console.log('[OSRS Filter] Column Mapping:', { methodIndex, intensityIndex, reqIndex, skillsIndex, categoryIndex });

  if (methodIndex === -1 || intensityIndex === -1) {
    console.warn('[OSRS Filter] Could not map Method or Intensity columns.');
    return;
  }

  // Step C: Create Shadow DOM host
  const host = document.createElement('div');
  host.id = 'osrs-filter-host';
  table.parentNode!.insertBefore(host, table);

  const shadow = host.attachShadow({ mode: 'open' });

  // Inject styles into shadow root (for the Svelte panel)
  const style = document.createElement('style');
  style.textContent = panelCss;
  shadow.appendChild(style);

  // Inject styles into document head (for the table row chips and hide buttons)
  const globalStyle = document.createElement('style');
  globalStyle.textContent = panelCss;
  globalStyle.id = 'osrs-filter-global-styles';
  if (!document.getElementById('osrs-filter-global-styles')) {
    document.head.appendChild(globalStyle);
  }

  // Mount container
  const container = document.createElement('div');
  shadow.appendChild(container);

  // Step D: Mount Svelte App
  mount(App, {
    target: container,
    props: {
      table,
      methodIndex,
      intensityIndex,
      reqIndex,
      skillsIndex,
      categoryIndex,
    },
  });

  console.log('[OSRS Filter] Svelte panel mounted successfully.');
}

// Initialize when DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
} else {
  window.addEventListener('DOMContentLoaded', init);
}
