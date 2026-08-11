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
 * Typed message bus for chrome.runtime communication.
 * Wraps chrome.runtime.sendMessage with proper TypeScript types.
 */

import type {
  PlayerStats,
  PlayerStatsResponse,
  SubpageWarning,
  WarningResponse,
  BackgroundMessage,
} from '../types';

/**
 * Fetch player stats from background service worker.
 */
export function fetchPlayerStats(username: string): Promise<PlayerStats | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'fetchPlayerStats', username },
      (response: PlayerStatsResponse) => {
        if (chrome.runtime.lastError) {
          console.error('[OSRS Filter] Service Worker Error:', chrome.runtime.lastError);
          resolve(null);
        } else if (response?.success && response.stats) {
          resolve(response.stats);
        } else {
          console.warn('[OSRS Filter] Fetch returned unsuccessful response:', response);
          resolve(null);
        }
      }
    );
  });
}

/**
 * Request subpage financial/warning data from background.
 */
export function checkSubpageWarnings(
  pageTitles: string[]
): Promise<Record<string, SubpageWarning>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'checkPageWarnings', pageTitles },
      (response: WarningResponse) => {
        if (chrome.runtime.lastError) {
          console.error('[OSRS Filter] Warning check error:', chrome.runtime.lastError);
          resolve({});
        } else if (response?.success && response.warningMap) {
          resolve(response.warningMap);
        } else {
          resolve({});
        }
      }
    );
  });
}

/**
 * Purge cached financial data and re-fetch.
 */
export function purgeAndRefetch(
  pageTitles: string[]
): Promise<Record<string, SubpageWarning>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'purgeFinancialCache', pageTitles },
      (response: WarningResponse) => {
        if (chrome.runtime.lastError) {
          console.error('[OSRS Filter] Purge error:', chrome.runtime.lastError);
          resolve({});
        } else if (response?.success && response.warningMap) {
          resolve(response.warningMap);
        } else {
          resolve({});
        }
      }
    );
  });
}

/**
 * Register a listener for background push messages.
 */
export function onBackgroundMessage(
  handler: (message: BackgroundMessage) => void
): void {
  chrome.runtime.onMessage.addListener(
    (message: BackgroundMessage, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: any) => void) => {
      if (message.action === 'warningsUpdated' || message.action === 'syncLog') {
        handler(message);
      }
    }
  );
}
