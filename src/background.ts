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
 * Background Service Worker for OSRS Money Making Filter
 * Handles cross-origin API calls to Jagex Hiscores, Wise Old Man API, and MediaWiki API
 */

import type { PlayerStats, SubpageWarning, XpGained } from './types';

/** MediaWiki action=parse category entry (shape varies by API version). */
interface ParseCategory {
  '*'?: string;
  title?: string;
  name?: string;
}

/** MediaWiki action=parse template entry. */
interface ParseTemplate {
  '*'?: string;
  title?: string;
}

/** Financial metrics parsed out of a rendered MMG subpage. */
interface Financials {
  inputCost: number;
  grossOutput: number;
  roi: number;
  outputVolume: number;
}

/** Risk flags derived from a rendered MMG subpage. */
interface RiskFlags {
  hasWildernessWarning: boolean;
  hasWarning: boolean;
}

let warningCache: Record<string, SubpageWarning> = {};
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 Hours
const CACHE_STORAGE_KEY = 'mmgCache_v8';

// Keywords matched against MediaWiki action=parse rendered HTML (full article body text).
// Intentionally broader than WILDERNESS_DOM_KEYWORDS in riskKeywords.ts, which matches
// compact wiki table cell text. This list covers in-article phrases and risk warnings
// (e.g. 'loss of items', 'pker') that do not appear in table rows but do appear in
// subpage article bodies. Keep in sync with riskKeywords.ts for shared boss/location names.
const WILDERNESS_WIKITEXT_KEYWORDS = [
  'wilderness', 'wildy', 'pvp', 'pker', 'pkers', 'pked', 'deep wild',
  'high risk', 'loss of items', 'items you are not willing to lose',
  'located in wilderness', 'chaos elemental', 'revenant', 'scorpia',
  'venenatis', 'vet\'ion', 'vetion', 'callisto', 'chaos fanatic',
  'crazy archaeologist', 'fountain of rune', 'black chinchompa',
  'lava dragon', 'rogue chest', 'rogues castle', 'spindel', 'artio',
  'calvar\'ion', 'calvarion', 'zombie pirate'
];

let volumeMapCache: Record<string, number> | null = null;
let volumeMapFetchTime = 0;

async function getVolumeMap(): Promise<Record<string, number>> {
  if (volumeMapCache && (Date.now() - volumeMapFetchTime < CACHE_TTL_MS)) {
    return volumeMapCache;
  }

  if (chrome?.storage?.local) {
    const stored = await new Promise<{ volumeMapCache?: Record<string, number>; volumeMapFetchTime?: number }>(
      (r) => chrome.storage.local.get(['volumeMapCache', 'volumeMapFetchTime'], r)
    );
    if (stored?.volumeMapCache && stored?.volumeMapFetchTime && (Date.now() - stored.volumeMapFetchTime < CACHE_TTL_MS)) {
      volumeMapCache = stored.volumeMapCache;
      volumeMapFetchTime = stored.volumeMapFetchTime;
      return volumeMapCache;
    }
  }

  try {
    const [mappingRes, volRes] = await Promise.all([
      fetchWithBackoff('https://prices.runescape.wiki/api/v1/osrs/mapping', 3),
      fetchWithBackoff('https://prices.runescape.wiki/api/v1/osrs/24h', 3)
    ]);

    if (mappingRes && mappingRes.ok && volRes && volRes.ok) {
      const mapping = await mappingRes.json();
      const volData = await volRes.json();
      const map: Record<string, number> = {};
      const volumes = volData?.data || {};

      if (Array.isArray(mapping)) {
        mapping.forEach((item) => {
          if (item?.id && item?.name) {
            const itemVol = volumes[item.id];
            const totalVol = (itemVol?.highPriceVolume || 0) + (itemVol?.lowPriceVolume || 0);
            map[item.name.toLowerCase()] = totalVol;
          }
        });
      }

      volumeMapCache = map;
      volumeMapFetchTime = Date.now();

      if (chrome?.storage?.local) {
        chrome.storage.local.set({ volumeMapCache, volumeMapFetchTime });
      }

      return volumeMapCache;
    }
  } catch (err) {
    console.warn('[OSRS Filter Debug] Volume map fetch failed:', err);
  }

  return volumeMapCache || {};
}



// Load persistent cache from chrome.storage.local on startup
let hydrationPromise: Promise<void> | null = null;
if (chrome?.storage?.local) {
  hydrationPromise = new Promise((resolve) => {
    chrome.storage.local.get([CACHE_STORAGE_KEY, 'mmgCacheTime'], (res) => {
      const cacheTime = res?.mmgCacheTime as number | undefined;
      if (res?.[CACHE_STORAGE_KEY] && cacheTime) {
        if (Date.now() - cacheTime < CACHE_TTL_MS) {
          Object.assign(warningCache, res[CACHE_STORAGE_KEY]);
        }
      }
      resolve();
    });
  });
} else {
  hydrationPromise = Promise.resolve();
}

function persistCache(): void {
  if (chrome?.storage?.local) {
    chrome.storage.local.set({
      [CACHE_STORAGE_KEY]: warningCache,
      mmgCacheTime: Date.now()
    });
  }
}

// Concurrency-throttled batch processing to prevent HTTP 429 rate limiting
let globalRateLimitUntil = 0;

// Helper function for network requests with exponential backoff, global 429 pause, and Retry-After support
async function fetchWithBackoff(
  url: string,
  options: RequestInit | number = {},
  maxAttempts = 5
): Promise<Response | null> {
  if (typeof options === 'number') {
    maxAttempts = options;
    options = {};
  }
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;

    // Wait out any active global rate limit cooldown across all operations
    const now = Date.now();
    if (globalRateLimitUntil > now) {
      const waitTime = globalRateLimitUntil - now;
      await new Promise((r) => setTimeout(r, waitTime));
    }

    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const delay = retryAfter ? (parseInt(retryAfter, 10) * 1000) : Math.min(8000, 2000 * Math.pow(2, attempts - 1));
        globalRateLimitUntil = Math.max(globalRateLimitUntil, Date.now() + delay);
        console.warn(`[OSRS Filter Debug] HTTP 429 Rate Limited. Pausing outgoing requests globally for ${delay}ms (Attempt ${attempts}/${maxAttempts})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err) {
      const delay = 1000 * Math.pow(2, attempts - 1);
      if (attempts >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

async function fetchInBatches<T>(
  items: T[],
  batchSize: number,
  delayMs: number,
  workerFn: (item: T) => Promise<void>,
  onBatchComplete?: () => void | Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(workerFn));
    if (onBatchComplete) {
      try {
        await onBatchComplete();
      } catch (e) { /* ignore progress-callback errors */ }
    }
    if (i + batchSize < items.length && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

function sendTabLog(
  tabId: number | undefined,
  level: 'log' | 'warn' | 'error' | 'info',
  message: string,
  details: string | null = null
): void {
  if (chrome?.tabs && tabId) {
    try {
      chrome.tabs.sendMessage(tabId, {
        action: 'syncLog',
        level,
        message,
        details
      });
    } catch (e) {
      // Ignored if tab closed or unavailable
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchPlayerStats') {
    handleFetchPlayerStats(request.username)
      .then((stats) => sendResponse({ success: true, stats }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async sendResponse
  }

  if (request.action === 'checkPageWarnings') {
    const tabId = sender?.tab?.id;
    handleCheckPageWarnings(request.pageTitles, tabId)
      .then((warningMap) => sendResponse({ success: true, warningMap }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'purgeFinancialCache') {
    const tabId = sender?.tab?.id;
    if (Array.isArray(request.pageTitles) && request.pageTitles.length > 0) {
      request.pageTitles.forEach((t: string) => {
        const norm = t.replace(/_/g, ' ');
        delete warningCache[norm.toLowerCase()];
      });
      persistCache();
    } else {
      warningCache = {};
      if (chrome?.storage?.local) {
        chrome.storage.local.remove([CACHE_STORAGE_KEY, 'mmgCacheTime']);
      }
    }
    handleCheckPageWarnings(request.pageTitles, tabId)
      .then((warningMap) => sendResponse({ success: true, warningMap }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function handleCheckPageWarnings(
  pageTitles: string[],
  tabId: number | undefined
): Promise<Record<string, SubpageWarning>> {
  if (!Array.isArray(pageTitles) || pageTitles.length === 0) {
    return {};
  }

  if (hydrationPromise) {
    await hydrationPromise;
  }

  const normalizedTitles = pageTitles.map((t) => t.replace(/_/g, ' '));

  const getResultMap = (): Record<string, SubpageWarning> => {
    const res: Record<string, SubpageWarning> = {};
    normalizedTitles.forEach((t) => {
      res[t] = warningCache[t.toLowerCase()] || {
        hasWildernessWarning: false,
        hasWarning: false,
        inputCost: 0,
        grossOutput: 0,
        roi: 99999,
        outputVolume: 0,
        xpGained: [],
        finParsed: false
      };
    });
    return res;
  };

  // Only skip titles if they are in warningCache AND have successfully parsed financials (finParsed)
  const missingTitles = normalizedTitles.filter((t) => {
    const cached = warningCache[t.toLowerCase()];
    return !cached || !cached.finParsed;
  });

  if (missingTitles.length > 0) {
    // Process missing titles asynchronously without blocking the immediate return
    processMissingTitlesInBackground(missingTitles, normalizedTitles, tabId);
  }

  // Return currently available cached map immediately (< 5ms)
  return getResultMap();
}

function extractRiskFromParseData(
  html: string,
  categories: ParseCategory[] = [],
  templates: ParseTemplate[] = []
): RiskFlags {
  let hasWildernessWarning = false;
  let hasWarning = false;

  // Strip out the global navigation boxes at the bottom of the page that contain links to all other methods
  let cleanHtml = html || '';
  const navboxIndex = cleanHtml.search(/<table[^>]*class="[^"]*navbox/i);
  if (navboxIndex !== -1) {
    cleanHtml = cleanHtml.substring(0, navboxIndex);
  }

  const htmlLower = cleanHtml.toLowerCase();

  // Check page categories
  if (Array.isArray(categories)) {
    categories.forEach((c) => {
      const cTitle = (c['*'] || c.title || '').toLowerCase();
      if (cTitle.includes('mmg/risky') || cTitle.includes('risky')) {
        hasWarning = true;
      }
      if (cTitle.includes('wilderness') || cTitle.includes('pvp')) {
        hasWildernessWarning = true;
        hasWarning = true;
      }
    });
  }

  // Check page templates
  if (Array.isArray(templates)) {
    templates.forEach((t) => {
      const tName = (t['*'] || t.title || '').toLowerCase();
      if (
        tName.includes('wilderness') ||
        tName.includes('wildy') ||
        tName.includes('pvp') ||
        tName.includes('dangerous') ||
        tName.includes('danger')
      ) {
        hasWildernessWarning = true;
        hasWarning = true;
      }
      if (
        tName.includes('warning') ||
        tName.includes('notice') ||
        tName.includes('risk') ||
        tName.includes('disclaimer') ||
        tName.includes('caution') ||
        tName.includes('caveat') ||
        tName.includes('ambox') ||
        tName.includes('ombox') ||
        tName.includes('mmg warning') ||
        tName.includes('mmgwarning')
      ) {
        hasWarning = true;
      }
    });
  }

  // Check wikitext warning text rendered in HTML

  if (WILDERNESS_WIKITEXT_KEYWORDS.some((kw) => htmlLower.includes(kw))) {
    if (htmlLower.includes('warning') || htmlLower.includes('notice') || htmlLower.includes('danger') || htmlLower.includes('risk') || htmlLower.includes('wilderness')) {
      hasWildernessWarning = true;
      hasWarning = true;
    }
  }

  return { hasWildernessWarning, hasWarning };
}

async function processMissingTitlesInBackground(
  missingTitles: string[],
  normalizedTitles: string[],
  tabId: number | undefined
): Promise<void> {
  sendTabLog(tabId, 'info', `Starting background metrics sync for ${missingTitles.length} methods...`);

  let volumeMap: Record<string, number> = {};
  try {
    volumeMap = await getVolumeMap();
  } catch (volErr) {
    sendTabLog(tabId, 'warn', 'Failed to fetch OSRS volume map.', (volErr as Error)?.message);
  }

  const getResultMap = (): Record<string, SubpageWarning> => {
    const res: Record<string, SubpageWarning> = {};
    normalizedTitles.forEach((t) => {
      res[t] = warningCache[t.toLowerCase()];
    });
    return res;
  };

  const totalTitles = normalizedTitles.length;

  const sendProgressUpdate = (): void => {
    persistCache();
    let parsedCount = 0;
    normalizedTitles.forEach((t) => {
      const obj = warningCache[t.toLowerCase()];
      if (obj && obj.finParsed) parsedCount++;
    });
    const isComplete = parsedCount >= totalTitles;
    if (chrome?.tabs && tabId) {
      try {
        chrome.tabs.sendMessage(tabId, {
          action: 'warningsUpdated',
          warningMap: getResultMap(),
          parsedCount,
          totalTitles,
          isComplete
        });
      } catch (e) { /* tab closed/unavailable */ }
    }
  };

  // Send immediate initial progress ping to set initial count
  sendProgressUpdate();

  // Gentle GET requests for subpage HTML parsing (batchSize=2, delay=180ms for optimal rate-limit safety & MV3 stability)
  try {
    await fetchInBatches(missingTitles, 2, 180, async (rawTitle) => {
      const titleKey = rawTitle.replace(/_/g, ' ');
      let targetObj = warningCache[titleKey.toLowerCase()];
      if (!targetObj) {
        targetObj = {
          hasWildernessWarning: false,
          hasWarning: false,
          inputCost: 0,
          grossOutput: 0,
          roi: 99999,
          outputVolume: 0,
          xpGained: [],
          finParsed: false
        };
        warningCache[titleKey.toLowerCase()] = targetObj;
      }

      try {
        const parseUrl = `https://oldschool.runescape.wiki/api.php?action=parse&page=${encodeURIComponent(rawTitle)}&prop=text|categories|templates&format=json&origin=*`;
        const pRes = await fetchWithBackoff(parseUrl, 3);

        if (pRes && pRes.ok) {
          const pData = await pRes.json();
          if (pData?.parse) {
            const html = pData.parse.text?.['*'] || '';
            const categories = pData.parse.categories || [];
            const templates = pData.parse.templates || [];

            const fin = parseMmgFinancialsFromHtml(html, volumeMap, rawTitle, categories);
            const risk = extractRiskFromParseData(html, categories, templates);
            const xpList = extractXpGainedFromHtml(html);

            targetObj.inputCost = fin.inputCost;
            targetObj.grossOutput = fin.grossOutput;
            targetObj.roi = fin.roi;
            targetObj.outputVolume = fin.outputVolume;

            targetObj.hasWildernessWarning = risk.hasWildernessWarning;
            targetObj.hasWarning = risk.hasWarning;
            targetObj.xpGained = xpList;
          }
        }
      } catch (fetchErr) {
        console.warn(`[OSRS Filter Debug] Subpage parse failed for "${rawTitle}":`, fetchErr);
      } finally {
        targetObj.finParsed = true;
      }
    }, sendProgressUpdate);
  } catch (err) {
    console.error('[OSRS Filter Debug] Financial parsing batch error:', err);
    sendTabLog(tabId, 'error', 'Financial parsing batch error: ' + ((err as Error)?.message || err));
  } finally {
    sendProgressUpdate();
  }
}

const COMBAT_TITLE_PREFIXES = [
  'killing', 'chambers of', 'theatre of', 'tombs of', 'moons of', 'barrows',
  'fortis colosseum', 'the gauntlet', 'the corrupted gauntlet', 'last man standing'
];

const ITEM_CREATION_KEYWORDS = [
  'smelting', 'tanning', 'making', 'fletching', 'cooking', 'crafting',
  'grinding', 'crushing', 'casting', 'enchanting', 'charging', 'cleaning',
  'collecting', 'cutting', 'opening', 'exchanging', 'stringing', 'humidifying',
  'decanting', 'baking', 'brewing', 'spinning', 'mining', 'catching',
  'hunting', 'harvesting', 'picking', 'chopping', 'buying', 'plucking'
];

function isVolumeApplicable(
  rawTitle: string,
  categories: ParseCategory[],
  outputItemCount: number
): boolean {
  const subpageTitle = rawTitle.replace(/^Money making guide\//i, '').toLowerCase();

  // Exclude combat, bossing, or raid methods
  if (COMBAT_TITLE_PREFIXES.some((p) => subpageTitle.includes(p))) return false;
  if (categories.some((c) => (c['*'] || c.name || '').includes('MMG/Combat'))) return false;

  // Must have 1 or 2 focused output items (not a multi-item drop table)
  if (outputItemCount < 1 || outputItemCount > 2) return false;

  // Check if title or category indicates item creation / processing / collecting
  const isCreationTitle = ITEM_CREATION_KEYWORDS.some((k) => subpageTitle.includes(k));
  const isCreationCategory = categories.some((c) => {
    const catName = c['*'] || c.name || '';
    return catName.includes('MMG/Processing') || catName.includes('MMG/Collecting');
  });

  return isCreationTitle || isCreationCategory;
}

function extractXpGainedFromHtml(html: string): XpGained[] {
  if (!html) return [];
  let cleanHtml = html;
  const navboxIndex = cleanHtml.search(/<table[^>]*class="[^"]*navbox/i);
  if (navboxIndex !== -1) {
    cleanHtml = cleanHtml.substring(0, navboxIndex);
  }

  const results: XpGained[] = [];
  const expMatch = cleanHtml.match(/Experience gained[\s\S]*?<\/th>[\s\S]*?<td>([\s\S]*?)<\/td>/i) ||
                   cleanHtml.match(/<th[^>]*>[\s]*Experience gained[\s]*<\/th>\s*<\/tr>\s*<tr>[\s\S]*?<\/td>\s*<td>([\s\S]*?)<\/td>/i);

  const targetHtml = expMatch ? expMatch[1] : cleanHtml;
  const scpRegex = /data-skill="([^"]+)"[^>]*data-level="([^"]+)"/g;
  let match: RegExpExecArray | null;

  if (expMatch) {
    while ((match = scpRegex.exec(targetHtml)) !== null) {
      const skill = match[1].trim();
      const amountStr = match[2].replace(/,/g, '').replace(/\+/g, '').trim();
      const amount = parseInt(amountStr, 10);
      if (skill && !isNaN(amount) && skill.toLowerCase() !== 'achievement diary' && amount > 0) {
        results.push({ skill, xp: amount });
      }
    }
  }

  if (results.length === 0) {
    const mmgXpRegex = /<span[^>]*class="[^"]*mmg-xpline[^"]*"[\s\S]*?<span[^>]*data-skill="([^"]+)"[^>]*data-level="([^"]+)"/g;
    while ((match = mmgXpRegex.exec(cleanHtml)) !== null) {
      const skill = match[1].trim();
      const amountStr = match[2].replace(/,/g, '').replace(/\+/g, '').trim();
      const amount = parseInt(amountStr, 10);
      if (skill && !isNaN(amount) && skill.toLowerCase() !== 'achievement diary' && amount > 0) {
        results.push({ skill, xp: amount });
      }
    }
  }

  const skillMap = new Map<string, XpGained>();
  for (const item of results) {
    const existing = skillMap.get(item.skill);
    if (!existing || item.xp > existing.xp) {
      skillMap.set(item.skill, item);
    }
  }

  return Array.from(skillMap.values());
}

function parseMmgFinancialsFromHtml(
  html: string,
  volumeMap: Record<string, number> = {},
  rawTitle = '',
  categories: ParseCategory[] = []
): Financials {
  if (!html) return { inputCost: 0, grossOutput: 0, roi: 99999, outputVolume: 0 };
  let totalInput = 0;
  let totalOutput = 0;

  const inputMatches = html.match(/class="[^"]*mmg-input[^"]*"[\s\S]*?<span class="coins[^"]*">([\d,]+)<\/span>/gi) || [];
  inputMatches.forEach((m) => {
    const numMatch = m.match(/<span class="coins[^"]*">([\d,]+)<\/span>/i);
    if (numMatch) {
      const val = parseInt(numMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(val)) totalInput += val;
    }
  });

  const outputMatches = html.match(/class="[^"]*mmg-output[^"]*"[\s\S]*?<span class="coins[^"]*">([\d,]+)<\/span>/gi) || [];
  outputMatches.forEach((m) => {
    const numMatch = m.match(/<span class="coins[^"]*">([\d,]+)<\/span>/i);
    if (numMatch) {
      const val = parseInt(numMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(val)) totalOutput += val;
    }
  });

  const netProfit = totalOutput - totalInput;
  const roi = totalInput > 0 ? (netProfit / totalInput) * 100 : 99999;

  let minOutputVolume = Infinity;
  let outputItemCount = 0;
  if (volumeMap && Object.keys(volumeMap).length > 0) {
    const outputBlocks = html.match(/class="[^"]*mmg-output[^"]*"[\s\S]*?(?=<span\s+class="[^"]*mmg-itemline|<\/td>|<\/div>|$)/gi) || [];
    const outputItemNames = new Set<string>();

    outputBlocks.forEach((block) => {
      const linkMatches = block.match(/<a[^>]*title="([^"]+)"[^>]*>/gi) || [];
      linkMatches.forEach((tag) => {
        const titleMatch = tag.match(/title="([^"]+)"/i);
        if (titleMatch) {
          const name = titleMatch[1].trim().toLowerCase();
          if (
            name !== 'coins' &&
            !name.includes(':') &&
            !name.includes('money making') &&
            !name.includes('grand exchange') &&
            !name.includes('ge tax') &&
            !name.includes('convenience fee')
          ) {
            outputItemNames.add(name);
          }
        }
      });
    });

    outputItemCount = outputItemNames.size;
    for (const itemName of outputItemNames) {
      if (volumeMap[itemName] !== undefined && volumeMap[itemName] > 0) {
        const vol = volumeMap[itemName];
        if (vol < minOutputVolume) minOutputVolume = vol;
      }
    }
  }

  const outputVolume = (minOutputVolume !== Infinity && isVolumeApplicable(rawTitle, categories, outputItemCount))
    ? minOutputVolume
    : 0;

  return {
    inputCost: totalInput,
    grossOutput: totalOutput,
    roi: Math.round(roi),
    outputVolume
  };
}

async function handleFetchPlayerStats(username: string): Promise<PlayerStats | null> {
  const cleanUsername = username.trim();
  if (!cleanUsername) return null;

  // 1. Try Wise Old Man API first
  try {
    const womUrl = `https://api.wiseoldman.net/v2/players/username/${encodeURIComponent(cleanUsername)}`;
    const res = await fetch(womUrl);
    if (res.ok) {
      const data = await res.json();
      if (data?.latestSnapshot?.data?.skills) {
        const rawSkills = data.latestSnapshot.data.skills;
        const stats: PlayerStats = {};
        for (const [skillKey, skillData] of Object.entries<{ level?: number }>(rawSkills)) {
          if (skillData && typeof skillData.level === 'number') {
            stats[skillKey.toLowerCase()] = skillData.level;
          }
        }
        return stats;
      }
    }
  } catch (e) {
    console.warn('Wise Old Man API fetch failed:', e);
  }

  // 2. Try official Jagex Hiscores JSON API
  try {
    const jsonUrl = `https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=${encodeURIComponent(cleanUsername)}`;
    const res = await fetch(jsonUrl);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.skills)) {
        const stats: PlayerStats = {};
        data.skills.forEach((s: { name?: string; level?: number }) => {
          if (s.name && typeof s.level === 'number') {
            stats[s.name.toLowerCase()] = s.level > 0 ? s.level : (s.name.toLowerCase() === 'hitpoints' ? 10 : 1);
          }
        });
        return stats;
      }
    }
  } catch (e) {
    console.warn('Jagex Hiscores JSON fetch failed:', e);
  }

  // 3. Fallback to official Jagex Hiscores CSV API
  try {
    const csvUrl = `https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=${encodeURIComponent(cleanUsername)}`;
    const res = await fetch(csvUrl);
    if (res.ok) {
      const csvText = await res.text();
      const lines = csvText.split(/\r?\n/);
      const jagexSkillsOrder = [
        'overall', 'attack', 'defence', 'strength', 'hitpoints', 'ranged',
        'prayer', 'magic', 'cooking', 'woodcutting', 'fletching', 'fishing',
        'firemaking', 'crafting', 'smithing', 'mining', 'herblore', 'agility',
        'thieving', 'slayer', 'farming', 'runecraft', 'hunter', 'construction'
      ];
      const stats: PlayerStats = {};
      jagexSkillsOrder.forEach((skill, index) => {
        if (lines[index]) {
          const parts = lines[index].split(',');
          if (parts.length >= 2) {
            const lvl = parseInt(parts[1], 10);
            stats[skill] = lvl > 0 ? lvl : (skill === 'hitpoints' ? 10 : 1);
          }
        }
      });
      return stats;
    }
  } catch (e) {
    console.error('Jagex Hiscores CSV fetch failed:', e);
  }

  return null;
}
