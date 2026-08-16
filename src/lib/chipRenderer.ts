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
 * Chip Renderer — injects ROI and Budget badge chips into wiki table cells.
 * This is the bridge between our Svelte reactive world and the wiki's native DOM.
 */

import { ROI_UNAVAILABLE, type SubpageWarning } from '../types';
import { formatGp, formatXp, formatVolume } from './formatters';

/**
 * Render ROI + Budget + XP chip badges into a method cell's chip container.
 */
export function renderChipsForCell(
  methodCell: HTMLTableCellElement,
  warning: SubpageWarning | null | undefined,
  isSyncing: boolean
): void {
  methodCell.classList.add('osrs-method-cell');

  let chipContainer = methodCell.querySelector('.osrs-chip-container') as HTMLSpanElement | null;
  if (!chipContainer) {
    chipContainer = document.createElement('span');
    chipContainer.className = 'osrs-chip-container';
    methodCell.appendChild(chipContainer);
  }

  if (warning && (warning.finParsed || warning.inputCost > 0)) {
    const inputCost = warning.inputCost || 0;
    const roi = warning.roi ?? ROI_UNAVAILABLE;
    const outputVolume = warning.outputVolume ?? 0;
    const isCategoryAllowed = isRowCategoryVolumeApplicable(methodCell);

    let volumeChip: HTMLElement | null = null;
    if (outputVolume > 0 && isCategoryAllowed) {
      volumeChip = createOrGet(chipContainer, '.osrs-chip-volume', 'span', '');
      renderVolumeChip(volumeChip, outputVolume);
    } else {
      removeEl(chipContainer, '.osrs-chip-volume');
    }

    let xpChip: HTMLElement | null = null;
    if (warning.xpGained && warning.xpGained.length > 0) {
      xpChip = createOrGet(chipContainer, '.osrs-chip-xp', 'span', '');
      renderXpChip(xpChip, warning.xpGained);
    } else {
      removeEl(chipContainer, '.osrs-chip-xp');
    }

    if (inputCost === 0) {
      const spacer = createOrGet(chipContainer, '.osrs-chip-roi-spacer', 'span', 'osrs-chip-roi-spacer');
      const budgetChip = createOrGet(chipContainer, '.osrs-chip-budget', 'span', '');
      removeEl(chipContainer, '.osrs-chip-roi');
      removeEl(chipContainer, '.osrs-chip-loading');

      renderBudgetChip(budgetChip, 'osrs-chip-budget-zero', 0, '0 GP Input',
        'Hourly Supply Input Cost: 0 GP/hr (No upfront supplies or capital required)');
      const children = [volumeChip, xpChip, spacer, budgetChip].filter(Boolean) as HTMLElement[];
      chipContainer.replaceChildren(...children);
    } else {
      const budgetChip = createOrGet(chipContainer, '.osrs-chip-budget', 'span', '');
      removeEl(chipContainer, '.osrs-chip-roi-spacer');
      removeEl(chipContainer, '.osrs-chip-loading');

      // ROI chip — skip entirely if ROI is the "undefined" sentinel (should only
      // happen with a zero input cost, but guard here so it can never render as
      // a bogus "99999% ROI" if the invariant is ever violated upstream).
      let roiChip: HTMLElement | null = null;
      if (roi < ROI_UNAVAILABLE) {
        roiChip = createOrGet(chipContainer, '.osrs-chip-roi', 'span', '');
        const roiText = `${roi}%`;
        const inputFormatted = formatGp(inputCost);
        if (roi >= 50) {
          renderRoiChip(roiChip, 'osrs-chip-roi-high',
            `${roiText} ROI`,
            `Return on Investment (ROI): ${roiText} profit return relative to supply input cost (${inputFormatted} GP/hr input). High margin!`);
        } else if (roi >= 15) {
          renderRoiChip(roiChip, 'osrs-chip-roi-mod',
            `${roiText} ROI`,
            `Return on Investment (ROI): ${roiText} profit return relative to supply input cost (${inputFormatted} GP/hr input). Moderate margin.`);
        } else {
          renderRoiChip(roiChip, 'osrs-chip-roi-low',
            `${roiText} ROI`,
            `Return on Investment (ROI): ${roiText} profit return relative to supply input cost (${inputFormatted} GP/hr input). Thin margin!`);
        }
      } else {
        removeEl(chipContainer, '.osrs-chip-roi');
      }

      // Budget chip
      const costStr = inputCost.toLocaleString();
      if (inputCost < 100_000) {
        renderBudgetChip(budgetChip, 'osrs-chip-budget-low', 1, `${formatGp(inputCost)} Input`,
          `Hourly Supply Input Cost: ${costStr} GP/hr required for supplies & materials (Low investment)`);
      } else if (inputCost <= 1_000_000) {
        renderBudgetChip(budgetChip, 'osrs-chip-budget-mod', 2, `${formatGp(inputCost)} Input`,
          `Hourly Supply Input Cost: ${costStr} GP/hr required for supplies & materials (Moderate investment)`);
      } else if (inputCost <= 5_000_000) {
        renderBudgetChip(budgetChip, 'osrs-chip-budget-high', 3, `${formatGp(inputCost)} Input`,
          `Hourly Supply Input Cost: ${costStr} GP/hr required for supplies & materials (High investment)`);
      } else {
        renderBudgetChip(budgetChip, 'osrs-chip-budget-heavy', 4, `${formatGp(inputCost)} Input`,
          `Hourly Supply Input Cost: ${costStr} GP/hr required for supplies & materials (Heavy capital investment)`);
      }

      const children = [volumeChip, xpChip, roiChip, budgetChip].filter(Boolean) as HTMLElement[];
      chipContainer.replaceChildren(...children);
    }
  } else if (isSyncing) {
    const spacer = createOrGet(chipContainer, '.osrs-chip-roi-spacer', 'span', 'osrs-chip-roi-spacer');
    let loadingChip = chipContainer.querySelector('.osrs-chip-loading') as HTMLSpanElement | null;
    if (!loadingChip) {
      loadingChip = document.createElement('span');
      loadingChip.className = 'osrs-chip-loading';
      loadingChip.title = 'Fetching live supply input costs...';
      loadingChip.innerHTML = `<svg class="osrs-spinner-svg" width="11" height="11" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg> Loading GP...`;
    }
    removeEl(chipContainer, '.osrs-chip-volume');
    removeEl(chipContainer, '.osrs-chip-xp');
    removeEl(chipContainer, '.osrs-chip-roi');
    removeEl(chipContainer, '.osrs-chip-budget');
    chipContainer.replaceChildren(spacer, loadingChip);
  } else {
    chipContainer.replaceChildren();
  }
}

// ─── Internal Helpers ─────────────────────────────────────────

function renderVolumeChip(el: HTMLElement, volume: number): void {
  const isLow = volume < 25_000;
  const className = isLow ? 'osrs-chip-volume-low' : 'osrs-chip-volume-norm';
  const label = formatVolume(volume);
  const title = isLow
    ? `24h Output Trade Volume: ${volume.toLocaleString()} items traded per day on GE (Low trade volume — output items may sell slowly)`
    : `24h Output Trade Volume: ${volume.toLocaleString()} items traded per day on Grand Exchange`;

  el.className = `osrs-chip-volume ${className}`;
  el.title = title;
  el.replaceChildren();

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'osrs-chip-volume-svg');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  svg.setAttribute('viewBox', '0 0 24 24');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  if (isLow) {
    path.setAttribute('d', 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z');
  } else {
    path.setAttribute('d', 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z');
  }
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);

  el.appendChild(svg);
  el.appendChild(document.createTextNode(label));
}

function createOrGet(parent: Element, selector: string, tag: string, className: string): HTMLElement {
  let el = parent.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = document.createElement(tag);
    if (className) el.className = className;
  }
  return el;
}

function removeEl(parent: Element, selector: string): void {
  const el = parent.querySelector(selector);
  if (el) el.remove();
}

function renderRoiChip(el: HTMLElement, className: string, text: string, title: string): void {
  el.className = `osrs-chip-roi ${className}`;
  el.title = title;
  el.replaceChildren();

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'osrs-chip-roi-svg');
  svg.setAttribute('width', '11');
  svg.setAttribute('height', '11');
  svg.setAttribute('viewBox', '0 0 12 12');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M1 9L4.5 5.5L7 8L11 3M11 3H8M11 3V6');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('fill', 'none');
  svg.appendChild(path);

  el.appendChild(svg);
  el.appendChild(document.createTextNode(text));
}

function renderBudgetChip(
  el: HTMLElement, className: string, filledBars: number,
  label: string, title: string
): void {
  el.className = `osrs-chip-budget ${className}`;
  el.title = title;
  el.replaceChildren();

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'osrs-budget-meter-svg');
  svg.setAttribute('width', '13');
  svg.setAttribute('height', '10');
  svg.setAttribute('viewBox', '0 0 13 10');

  const heights = [3.5, 5.5, 7.5, 9.5];
  for (let i = 0; i < 4; i++) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', (i * 3.3).toFixed(1));
    rect.setAttribute('y', (10 - heights[i]).toFixed(1));
    rect.setAttribute('width', '2.2');
    rect.setAttribute('height', heights[i].toFixed(1));
    rect.setAttribute('rx', '0.7');
    rect.setAttribute('class', i < filledBars ? 'osrs-meter-bar filled' : 'osrs-meter-bar');
    svg.appendChild(rect);
  }

  el.appendChild(svg);
  el.appendChild(document.createTextNode(label));
}

function renderXpChip(el: HTMLElement, xpList: import('../types').XpGained[]): void {
  const sorted = [...xpList].sort((a, b) => b.xp - a.xp);
  const topSkill = sorted[0];

  let label = `${formatXp(topSkill.xp)} ${topSkill.skill}/hr`;
  if (sorted.length > 1) {
    label += ` (+${sorted.length - 1})`;
  }

  const skillDetails = sorted
    .map((item) => `• ${item.skill}: ${item.xp.toLocaleString()} XP/hr`)
    .join('\n');

  const title = sorted.length > 1
    ? `Hourly Skill Experience Gained (${sorted.length} skills total):\n${skillDetails}\n\n(+${sorted.length - 1} indicates additional skills also grant XP during this method)`
    : `Hourly Skill Experience Gained:\n${skillDetails}`;

  el.className = 'osrs-chip-xp';
  el.title = title;
  el.replaceChildren();

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'osrs-chip-xp-svg');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  svg.setAttribute('viewBox', '0 0 24 24');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M13 2L3 14h9l-1 8 10-12h-9l1-8z');
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);

  el.appendChild(svg);
  el.appendChild(document.createTextNode(label));
}

/**
 * Extract the method name from a cell, excluding injected UI elements.
 */
export function getMethodName(methodCell: Element): string {
  const clone = methodCell.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.osrs-row-hide-btn, .osrs-chip-volume, .osrs-chip-xp, .osrs-chip-roi, .osrs-chip-budget, .osrs-chip-container').forEach((el) => el.remove());
  return clone.textContent?.trim() || '';
}

/**
 * Extract the page title (wiki link target) from a method cell.
 */
export function getMethodPageTitle(methodCell: Element): string | null {
  const links = methodCell.querySelectorAll('a');
  for (const link of links) {
    const href = link.getAttribute('href');
    if (href) {
      const match = href.match(/\/w\/(Money_making_guide\/[^"]+)$/);
      if (match) return decodeURIComponent(match[1]).replace(/_/g, ' ');
    }
  }
  for (const link of links) {
    const href = link.getAttribute('href');
    if (href) {
      const match = href.match(/\/w\/(.+)$/);
      if (match && !match[1].startsWith('File:') && !match[1].startsWith('Category:')) {
        return decodeURIComponent(match[1]).replace(/_/g, ' ');
      }
    }
  }
  return null;
}

function isRowCategoryVolumeApplicable(methodCell: HTMLTableCellElement): boolean {
  const tr = methodCell.closest('tr');
  if (!tr) return true;

  const cells = Array.from(tr.children);
  for (const cell of cells) {
    const text = cell.textContent?.trim() || '';
    if (text.startsWith('Combat/')) return false;
    if (text === 'Skilling/Agility' || text === 'Skilling/Thieving') return false;
  }
  return true;
}
