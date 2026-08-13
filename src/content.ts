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
  //
  // We map each logical role (method, intensity, req, skills, category) to a
  // header column by SCORING every header against every role, then assigning
  // greedily. Scoring avoids the old first-match "else if" chain, which was
  // order-sensitive: a header matching more than one branch was silently
  // claimed by whichever branch happened to come first, and "method" could be
  // stolen by a later, weaker match. Here a header's score for a role is the
  // number of that role's keywords it contains, and we repeatedly assign the
  // single highest-scoring (role, header) pair that is still free. Ties in
  // score are broken deterministically by role order then header order, and a
  // header contested by two roles goes to the role that scores it higher (the
  // other role then falls back to its next-best header). A role with no
  // positive score stays unmapped (index -1), preserving the old contract.
  const headers = table.querySelectorAll('th');

  const roleKeywords = {
    method: ['method'],
    intensity: ['intensity'],
    req: ['req', 'detail', 'level'],
    skills: ['skill'],
    category: ['category', 'type'],
  } as const;
  type Role = keyof typeof roleKeywords;
  const roles = Object.keys(roleKeywords) as Role[];

  const headerTexts = Array.from(headers, (th) => getFullCellText(th).trim().toLowerCase());

  // score[role][headerIndex] = how many of the role's keywords the header text contains.
  const score: Record<Role, number[]> = {
    method: [],
    intensity: [],
    req: [],
    skills: [],
    category: [],
  };
  for (const role of roles) {
    score[role] = headerTexts.map((text) =>
      roleKeywords[role].reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0)
    );
  }

  const assigned: Record<Role, number> = {
    method: -1,
    intensity: -1,
    req: -1,
    skills: -1,
    category: -1,
  };

  // Greedily claim the best remaining (role, header) pair until no positive score is left.
  const rolesLeft = new Set<Role>(roles);
  const headersUsed = new Set<number>();
  while (rolesLeft.size > 0) {
    let bestRole: Role | null = null;
    let bestHeader = -1;
    let bestScore = 0;
    for (const role of roles) {
      if (!rolesLeft.has(role)) continue;
      for (let index = 0; index < headerTexts.length; index++) {
        if (headersUsed.has(index)) continue;
        if (score[role][index] > bestScore) {
          bestScore = score[role][index];
          bestRole = role;
          bestHeader = index;
        }
      }
    }
    if (bestRole === null) break;
    assigned[bestRole] = bestHeader;
    rolesLeft.delete(bestRole);
    headersUsed.add(bestHeader);
  }

  const methodIndex = assigned.method;
  const intensityIndex = assigned.intensity;
  const reqIndex = assigned.req;
  const skillsIndex = assigned.skills;
  const categoryIndex = assigned.category;

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

  // The same stylesheet (panel.css) is injected in TWO scopes on purpose:
  //
  //   1. Into the shadow root below, which styles the isolated Svelte filter
  //      panel. The shadow root deliberately walls the panel off from the
  //      wiki's CSS, but that same isolation means it cannot reach anything
  //      outside itself.
  //   2. Into the document head further down, which styles the row-level chips
  //      and hide buttons that we inject directly into the wiki's light-DOM
  //      table. Those elements live outside the shadow root, so the shadow
  //      copy of the stylesheet can never touch them.
  //
  // Every rule in panel.css is ".osrs-" prefixed, so injecting it globally into
  // the document head does not collide with the wiki's own styles.

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
