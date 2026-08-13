# OSRS Wiki Money Making Filter — Extension Guidelines & Context

This file provides architectural context, implementation rules, and developer instructions for Antigravity (`agy`) agents and contributors working on this codebase.

> [!IMPORTANT]
> **Maintain & Sync GEMINI.md**:
> Whenever making changes to this project that alter core functionality, file responsibilities, API patterns, or architectural rules, you MUST update this `GEMINI.md` file immediately. Always ensure this document remains accurate, complete, and truthful for future agents and developers.

---

## 📌 Project Overview
**OSRS Wiki Money Making Filter** is a Manifest V3 Chrome Extension that injects a custom, theme-adaptive filtering panel (`.osrs-filter-panel`) into the Old School RuneScape Wiki's "Money making guide" page (`https://oldschool.runescape.wiki/w/Money_making_guide*`).

---

## 📁 File Structure & Responsibilities

1. [`manifest.json`](file:///Users/stylianosgakis/PersonalProjects/OSRS-wiki-money-making-filter-plugin/manifest.json)
   - **Manifest V3** configuration (Version `1.0.3`).
   - Defines extension action and icon assets (`icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`).
   - Includes `"permissions": ["storage"]` for filter state persistence.
   - Includes `"host_permissions": ["https://api.wiseoldman.net/*", "https://secure.runescape.com/*", "https://oldschool.runescape.wiki/*", "https://*.runescape.wiki/*"]`.
   - Registers `"background": { "service_worker": "background.js" }`. Note: `background.js` here refers to the **build output** in `dist/`, not a hand-written source file. The source is `src/background.ts` (see below).
   - Injects the compiled `dist/content.js` at `document_idle`.

2. [`src/background.ts`](file:///Users/stylianosgakis/PersonalProjects/OSRS-wiki-money-making-filter-plugin/src/background.ts)
   - **TypeScript** source for the MV3 Background Service Worker. It is compiled into `dist/background.js` by a second Vite pass (`vite build --mode background`, see the Verification section). `background.js` therefore exists only as a build output in `dist/`; never hand-edit it, always edit `src/background.ts`.
   - Handles cross-origin API requests to bypass browser CORS restrictions in content scripts. Its responsibilities are now scoped to **networking, caching, and messaging only** — all pure HTML/regex parsing has been extracted into `src/lib/wikiParse.ts`, which the worker imports.
   - **`fetchPlayerStats`**: Fetches player stats from Wise Old Man API (`https://api.wiseoldman.net/v2/players/username/`) with fallbacks to Jagex Hiscores JSON and CSV endpoints (`https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws`).
   - **`getVolumeMap`**: Queries OSRS Wiki Price & Volume APIs (`https://prices.runescape.wiki/api/v1/osrs/mapping` and `https://prices.runescape.wiki/api/v1/osrs/24h`) to cache 24-hour trade volumes for output items.
   - **`checkPageWarnings` & `purgeFinancialCache`**: Queries the native OSRS MediaWiki API (`https://oldschool.runescape.wiki/w/api.php`) via lightweight per-subpage parsing (`action=parse&prop=text|categories|templates`) in a gentle 2-concurrency queue with 180ms inter-batch delays and a global 429 rate-limit backoff pause (`globalRateLimitUntil`). The raw `action=parse` payloads are passed to the pure parsers in `src/lib/wikiParse.ts`, which extract financial metrics (`inputCost`, `grossOutput`, `roi` %, `outputVolume`), risk flags (`hasWildernessWarning`, `hasWarning`), and experience gained (`xpGained`: Array of `{ skill, xp }`) without overloading MediaWiki or causing 0/xxx stalls. Forwards diagnostic background logs directly to active tabs via `sendTabLog` (`syncLog` action). Sends sub-batch progressive background push updates (`warningsUpdated` with `parsedCount`, `totalTitles`, `isComplete`) after every 2 items so content script sync progress and watchdog timer reset continuously. Handles selective title `purgeFinancialCache` requests to wipe cached target candidate subpages and force a fresh live sync. Persists all fetched method metadata in `chrome.storage.local` (`mmgCache_v8`, 6-hr TTL) to ensure 0 API calls are made on subsequent page reloads/navigations. Cache keys are normalized through `titleKey` from `src/lib/titleKey.ts`.

3. [`src/lib/wikiParse.ts`](file:///Users/stylianosgakis/PersonalProjects/OSRS-wiki-money-making-filter-plugin/src/lib/wikiParse.ts)
   - **Pure, unit-tested parsing module** extracted out of the background worker. Turns a rendered MMG subpage (HTML string + `categories` + `templates` from `action=parse`) into structured data, with no `chrome`/network dependencies. Exports `parseMmgFinancialsFromHtml` (financial metrics), `extractXpGainedFromHtml` (XP gained), `extractRiskFromParseData` (risk flags), and `isVolumeApplicable` (24h-volume applicability heuristic). Because a wiki template change can silently shift these numbers, the logic is isolated here and covered by fixture-based tests in `src/lib/__tests__/wikiParse.test.ts`.

4. [`src/lib/riskKeywords.ts`](file:///Users/stylianosgakis/PersonalProjects/OSRS-wiki-money-making-filter-plugin/src/lib/riskKeywords.ts)
   - **Single source of truth for risk keywords**, shared across BOTH detection paths so they can never drift apart. `WILDERNESS_CORE_KEYWORDS` holds the boss/location names common to both contexts; the content-script DOM matcher (`filterEngine.ts`) uses `WILDERNESS_DOM_KEYWORDS` (core + table-cell extras) and the background article-body parser (`wikiParse.ts`) uses `WILDERNESS_WIKITEXT_KEYWORDS` (core + in-article phrase extras). Also exports `RISKY_DOM_KEYWORDS` and `RISK_SIGNAL_WORDS` (generic risk/warning signal words that must co-occur with a wilderness keyword for rendered article text to count as risky).

5. [`src/lib/titleKey.ts`](file:///Users/stylianosgakis/PersonalProjects/OSRS-wiki-money-making-filter-plugin/src/lib/titleKey.ts)
   - **Canonical page-title normalization**, the single source of truth for title handling. `displayTitle` produces the human-facing form (underscores to spaces, trimmed); `titleKey` produces the lookup key (display form, lower-cased). All `warningCache`/`warningMap` reads and writes go through these helpers so a "store" site and a "lookup" site can never disagree.

6. [`src/content.ts`](file:///Users/stylianosgakis/PersonalProjects/OSRS-wiki-money-making-filter-plugin/src/content.ts) & Svelte Components
   - **Vite & Svelte 5 App**: Primary content script that manipulates the DOM, now structured as a modern Svelte 5 application.
   - **Shadow DOM Mounting**: `content.ts` creates a Shadow DOM host (`#osrs-filter-host`) to isolate the UI from the Wiki's global CSS, injecting styles inline and mounting `App.svelte`.
   - **Reactive State (`$state`)**: Filter state is managed centrally in `src/lib/stores.svelte.ts`, persisting automatically to `chrome.storage.local`.
   - **Componentized Layout**: Structured panel divided into reusable Svelte components (`FilterPanel`, `CriteriaSection` with Intensity, Budget, Margin, Skill XP dropdown & Min XP/hr controls, `RiskSection` with `hideWilderness` & `hideRisky` toggles, `ToolsSection`, `StatusBar`).
   - **Row ROI, Budget & XP Badges**: Handled via `src/lib/chipRenderer.ts` bridging the reactive world with the native DOM wiki table (rendering ROI, Budget, Volume, and Experience Gained chips like `⚡ 129.6k Magic/hr`).
   - **Native Table Sorting**: DOM rows are filtered purely using `row.style.display = 'none'` to preserve native tablesorter integrity.

7. [`src/panel.css`](file:///Users/stylianosgakis/PersonalProjects/OSRS-wiki-money-making-filter-plugin/src/panel.css)
   - Dynamically adapts to the OSRS Wiki's three official color schemes: **Light Mode**, **Dark Mode**, and **Browntown Mode** using `data-theme` attribute selectors inside the Shadow DOM.
   - Inlined by Vite during the build process directly into `dist/content.js`.

---

## ⚙️ Critical Constraints & Architectural Rules

> [!IMPORTANT]
> **1. Preserve Native Wiki Table Sorting**
> Do NOT implement any custom table sorting or DOM re-ordering logic. Row filtering MUST be handled exclusively via `row.style.display` (`''` for visible, `'none'` for hidden). This ensures native tablesorter functions remain intact.

> [!IMPORTANT]
> **2. Cross-Origin Requests via Background Worker Only**
> Do NOT perform direct `fetch()` calls to external APIs (`secure.runescape.com` or `wiseoldman.net`) inside `content.ts`. Always delegate via `chrome.runtime.sendMessage` to the background worker (`src/background.ts`, compiled to `dist/background.js`) to avoid CORS blocking.

> [!IMPORTANT]
> **3. Risk Keywords Single Source of Truth**
> All risk/wilderness keyword lists live in `src/lib/riskKeywords.ts`. Do NOT hand-maintain separate keyword arrays inside the content script and the background worker. Shared boss/location names belong in `WILDERNESS_CORE_KEYWORDS` (consumed by both `WILDERNESS_DOM_KEYWORDS` for content-script DOM matching and `WILDERNESS_WIKITEXT_KEYWORDS` for background article-body matching); add context-only phrases to the appropriate derived list, and keep generic signal words in `RISK_SIGNAL_WORDS`. Continue to rely on MediaWiki API categories and templates for risk evaluation alongside these keywords, rather than hardcoding static arrays of boss or item names at the call sites.

> [!IMPORTANT]
> **4. AGPL-3.0 License Headers on Every Source File**
> Every source file under `src/` (`*.ts`, `*.svelte`, including `src/background.ts`) MUST begin with the AGPL-3.0 copyright notice block. When you **create a new source file**, prepend the header before any other content. When you **modify an existing file**, verify the header is present and intact. The exact required format is:
> ```
> /*
>  * OSRS MMG Filter - Filter the OSRS Wiki Money Making Guide table
>  * Copyright (C) 2026  Stylianos Gakis
>  *
>  * This program is free software: you can redistribute it and/or modify
>  * it under the terms of the GNU Affero General Public License as published
>  * by the Free Software Foundation, either version 3 of the License, or
>  * (at your option) any later version.
>  *
>  * This program is distributed in the hope that it will be useful,
>  * but WITHOUT ANY WARRANTY; without even the implied warranty of
>  * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
>  * GNU Affero General Public License for more details.
>  *
>  * You should have received a copy of the GNU Affero General Public License
>  * along with this program. If not, see https://www.gnu.org/licenses/
>  *
>  * Source: https://github.com/StylianosGakis/osrs-mmg-filter
>  */
> ```
> **Note:** In `.svelte` files, the comment header MUST be placed inside the `<script>` tag (e.g. immediately after `<script lang="ts">`). Placing comment blocks outside `<script>` causes the Svelte compiler to render them as visible HTML template text in the DOM. Also, do NOT use angle-bracket URL syntax (`<https://...>`) in `.svelte` files — the Svelte compiler parses `<...>` as HTML tags and will throw errors. Use plain URLs as shown above.

---

## 🛠️ Verification & Syntax Testing Commands

Run **all four** checks before declaring work complete:
```bash
npm run check   # svelte-check: 0 errors required
npm run build   # check + two Vite passes (content, then `vite build --mode background` for the worker) + asset copy: must succeed
npm run zip     # builds + packages extension into osrs-money-making-filter.zip for Chrome Web Store upload
npm test        # vitest: the whole suite must pass (27+ tests)
```

> [!NOTE]
> **Two-pass build**: the content script and the MV3 service worker must each be a self-contained IIFE bundle, and Rollup's `iife` format supports only one entry per build. `npm run build` therefore runs `vite build` (content script, clears `dist/`) followed by `vite build --mode background` (worker, appends to `dist/`), then copies `manifest.json` and `icons/`. The first pass emits `dist/content.js` from `src/content.ts`; the second emits `dist/background.js` from `src/background.ts`.

To verify AGPL headers are present on all source files:
```bash
for f in $(find src -name '*.ts' -o -name '*.svelte'); do
  head -3 "$f" | grep -q 'OSRS MMG Filter' || echo "MISSING HEADER: $f"
done
```

To test in Chrome:
1. Open `chrome://extensions/`.
2. Enable **Developer Mode**.
3. Click **Load unpacked** and select the `dist/` directory.
4. Visit `https://oldschool.runescape.wiki/w/Money_making_guide`.
