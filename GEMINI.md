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
   - **Manifest V3** configuration (Version `1.0.0`).
   - Defines extension action and icon assets (`icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`).
   - Includes `"permissions": ["storage"]` for filter state persistence.
   - Includes `"host_permissions": ["https://api.wiseoldman.net/*", "https://secure.runescape.com/*", "https://oldschool.runescape.wiki/*", "https://*.runescape.wiki/*"]`.
   - Registers `"background": { "service_worker": "background.js" }`.
   - Injects the compiled `dist/content.js` at `document_idle`.

2. [`background.js`](file:///Users/stylianosgakis/PersonalProjects/OSRS-wiki-money-making-filter-plugin/background.js)
   - Background Service Worker handling cross-origin API requests to bypass browser CORS restrictions in content scripts.
   - **`fetchPlayerStats`**: Fetches player stats from Wise Old Man API (`https://api.wiseoldman.net/v2/players/username/`) with fallbacks to Jagex Hiscores JSON and CSV endpoints (`https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws`).
   - **`getVolumeMap`**: Queries OSRS Wiki Price & Volume APIs (`https://prices.runescape.wiki/api/v1/osrs/mapping` and `https://prices.runescape.wiki/api/v1/osrs/24h`) to cache 24-hour trade volumes for output items.
   - **`checkPageWarnings` & `purgeFinancialCache`**: Queries the native OSRS MediaWiki API (`https://oldschool.runescape.wiki/w/api.php`) via lightweight per-subpage parsing (`action=parse&prop=text|categories|templates`) in a gentle 2-concurrency queue with 180ms inter-batch delays and a global 429 rate-limit backoff pause (`globalRateLimitUntil`). Eliminates heavy 50-title raw wikitext revision queries (`rvprop=content`), extracting financial metrics (`inputCost`, `grossOutput`, `roi` %, `outputVolume`), risk flags (`hasWildernessWarning`, `hasWarning`), and experience gained (`xpGained`: Array of `{ skill, xp }`) without overloading MediaWiki or causing 0/xxx stalls. Forwards diagnostic background logs directly to active tabs via `sendTabLog` (`syncLog` action). Sends sub-batch progressive background push updates (`warningsUpdated` with `parsedCount`, `totalTitles`, `isComplete`) after every 2 items so content script sync progress and watchdog timer reset continuously. Handles selective title `purgeFinancialCache` requests to wipe cached target candidate subpages and force a fresh live sync. Persists all fetched method metadata in `chrome.storage.local` (`mmgCache_v8`, 6-hr TTL) to ensure 0 API calls are made on subsequent page reloads/navigations.

3. [`src/content.ts`](file:///Users/stylianosgakis/PersonalProjects/OSRS-wiki-money-making-filter-plugin/src/content.ts) & Svelte Components
   - **Vite & Svelte 5 App**: Primary content script that manipulates the DOM, now structured as a modern Svelte 5 application.
   - **Shadow DOM Mounting**: `content.ts` creates a Shadow DOM host (`#osrs-filter-host`) to isolate the UI from the Wiki's global CSS, injecting styles inline and mounting `App.svelte`.
   - **Reactive State (`$state`)**: Filter state is managed centrally in `src/lib/stores.svelte.ts`, persisting automatically to `chrome.storage.local`.
   - **Componentized Layout**: Structured panel divided into reusable Svelte components (`FilterPanel`, `CriteriaSection` with Intensity, Budget, Margin, Skill XP dropdown & Min XP/hr controls, `RiskSection` with `hideWilderness` & `hideRisky` toggles, `ToolsSection`, `StatusBar`).
   - **Row ROI, Budget & XP Badges**: Handled via `src/lib/chipRenderer.ts` bridging the reactive world with the native DOM wiki table (rendering ROI, Budget, Volume, and Experience Gained chips like `⚡ 129.6k Magic/hr`).
   - **Native Table Sorting**: DOM rows are filtered purely using `row.style.display = 'none'` to preserve native tablesorter integrity.

4. [`src/panel.css`](file:///Users/stylianosgakis/PersonalProjects/OSRS-wiki-money-making-filter-plugin/src/panel.css)
   - Dynamically adapts to the OSRS Wiki's three official color schemes: **Light Mode**, **Dark Mode**, and **Browntown Mode** using `data-theme` attribute selectors inside the Shadow DOM.
   - Inlined by Vite during the build process directly into `dist/content.js`.

---

## ⚙️ Critical Constraints & Architectural Rules

> [!IMPORTANT]
> **1. Preserve Native Wiki Table Sorting**
> Do NOT implement any custom table sorting or DOM re-ordering logic. Row filtering MUST be handled exclusively via `row.style.display` (`''` for visible, `'none'` for hidden). This ensures native tablesorter functions remain intact.

> [!IMPORTANT]
> **2. Cross-Origin Requests via Background Worker Only**
> Do NOT perform direct `fetch()` calls to external APIs (`secure.runescape.com` or `wiseoldman.net`) inside `content.ts`. Always delegate via `chrome.runtime.sendMessage` to `background.js` to avoid CORS blocking.

> [!IMPORTANT]
> **3. Subpage Warning Single Source of Truth**
> Rely exclusively on MediaWiki API subpage warnings, categories, and wikitext warning reason parameters (`subpageWarningMap`) for risk evaluation instead of hardcoding static arrays of boss or item names.

> [!IMPORTANT]
> **4. AGPL-3.0 License Headers on Every Source File**
> Every source file — `background.js` and all files under `src/` (`*.ts`, `*.svelte`) — MUST begin with the AGPL-3.0 copyright notice block. When you **create a new source file**, prepend the header before any other content. When you **modify an existing file**, verify the header is present and intact. The exact required format is:
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
> **Note:** Do NOT use angle-bracket URL syntax (`<https://...>`) in `.svelte` files — the Svelte compiler parses `<...>` as HTML tags and will throw errors. Use plain URLs as shown above.

---

## 🛠️ Verification & Syntax Testing Commands

Run **all three** checks before declaring work complete:
```bash
npm run check   # svelte-check: 0 errors required
npm run build   # vite build + asset copy: must succeed
npm run zip     # builds + packages extension into osrs-money-making-filter.zip for Chrome Web Store upload
npm test        # vitest: all 27 tests must pass
```

To verify AGPL headers are present on all source files:
```bash
for f in background.js $(find src -name '*.ts' -o -name '*.svelte'); do
  head -1 "$f" | grep -q 'OSRS MMG Filter' || echo "MISSING HEADER: $f"
done
```

To test in Chrome:
1. Open `chrome://extensions/`.
2. Enable **Developer Mode**.
3. Click **Load unpacked** and select the `dist/` directory.
4. Visit `https://oldschool.runescape.wiki/w/Money_making_guide`.
