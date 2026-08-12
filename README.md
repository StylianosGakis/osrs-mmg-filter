# OSRS MMG Filter

A Manifest V3 Chrome extension that injects a powerful, theme-aware filter panel directly into the [Old School RuneScape Wiki Money Making Guide](https://oldschool.runescape.wiki/w/Money_making_guide) — letting you slice through hundreds of methods to find exactly what fits your account and playstyle.

> **Fully open-source. No tracking. No account. No data collection.**

---

## Features

| Filter | Description |
|---|---|
| 🎮 **Intensity** | Show only AFK/Low, Moderate-or-lower, or High-intensity methods |
| 💰 **Max Budget** | Hide methods requiring more than a set hourly supply cost (100k / 1M / 5M / 10M GP) |
| 📈 **Min Margin (ROI)** | Show only methods with > 15% or > 50% return on investment |
| ⚔️ **Hide Wilderness / PvP** | Auto-exclude methods in dangerous areas using live wiki warnings |
| ⚠️ **Hide Risky / Volatile** | Exclude methods with unstable prices or slow GE resale |
| ⚡ **Skill XP Filter** | Filter by methods granting XP in a specific skill at a minimum XP/hr |
| 👤 **Player Stats Lookup** | Enter your RSN to load your skill levels from public hiscores — methods you can't access yet get hidden automatically |
| ✕ **Per-Row Hide** | Click the × on any row to exclude a specific method, with one-click restore |

### Live Chips on Every Row

After clicking **Load Data**, each money-making method row gets colour-coded badge chips showing:
- 📊 **ROI %** — colour-coded by margin tier (thin / moderate / high)
- 💸 **Supply Input Cost** — bar-meter showing how capital-intensive the method is
- 📦 **GE Volume** — daily trade volume for output items (highlights slow-selling methods)
- ⚡ **XP/hr** — hourly experience rate for each skill, if the method trains one

### Theme Support

Automatically detects and adapts to all three official OSRS Wiki colour schemes: **Light**, **Dark**, and **Browntown**.

---

## How It Works

The extension injects a Shadow DOM panel above the wiki table. Row visibility is controlled exclusively via `row.style.display`, so the wiki's native column-sorting functionality is fully preserved.

Financial data is fetched from public APIs:
- **OSRS Wiki MediaWiki API** — per-subpage financial metrics, risk categories, and experience data
- **OSRS Wiki Prices API** — Grand Exchange 24-hour trade volume for output items
- **Wise Old Man / Jagex Hiscores** — player skill levels (only when you click Lookup)

All data is cached locally in `chrome.storage.local` for 6 hours. No data is ever sent to any external server controlled by this project.

---

## Installation

### From the Chrome Web Store *(pending approval)*
Search for **OSRS MMG Filter** in the Chrome Web Store — the listing is currently under review.

### Manual / Developer Install
1. Clone this repository
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
3. Open `chrome://extensions/` in Chrome
4. Enable **Developer Mode** (top-right toggle)
5. Click **Load unpacked** and select the `dist/` directory
6. Visit the [OSRS Money Making Guide](https://oldschool.runescape.wiki/w/Money_making_guide)

---

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
npm install
```

### Commands

| Command | Description |
|---|---|
| `npm run build` | Production build to `dist/` |
| `npm run check` | TypeScript + Svelte type checking |
| `npm test` | Run unit tests (vitest) |
| `npm run test:watch` | Run tests in watch mode |

### Tech Stack

- **Svelte 5** with runes (`$state`, `$derived`, `$effect`) for reactive UI
- **TypeScript** with strict mode
- **Vite** for bundling (IIFE output format required by MV3 content scripts)
- **Shadow DOM** for CSS isolation from the wiki
- **Vitest** for unit testing the filter engine

### Project Structure

```
src/
├── content.ts              # Entry point: finds the wiki table, mounts Svelte app into Shadow DOM
├── App.svelte              # Root component: filter application logic, row evaluation loop
├── types.ts                # Shared TypeScript interfaces and union types
├── panel.css               # All styles — inlined by Vite, adapts to Light/Dark/Browntown themes
├── components/
│   ├── FilterPanel.svelte  # Shell layout: composes all sections
│   ├── CriteriaSection.svelte  # Intensity, Budget, Margin, Skill XP controls
│   ├── RiskSection.svelte  # Wilderness and Risky toggle chips
│   ├── ToolsSection.svelte # RSN lookup, Load Data / Resync, Clear buttons
│   ├── StatusBar.svelte    # Visible count, sync progress, active filter badges
│   ├── SegmentedControl.svelte  # Reusable pill-button group
│   ├── ToggleChip.svelte   # Toggle button chip
│   └── ActiveBadge.svelte  # Dismissible active filter badge
└── lib/
    ├── stores.svelte.ts    # Svelte 5 reactive state, chrome.storage.local persistence
    ├── filterEngine.ts     # Pure filter logic — no DOM dependencies, fully unit tested
    ├── chipRenderer.ts     # Renders ROI/budget/volume/XP chips into wiki table rows
    ├── requirementParser.ts  # Parses skill requirements from wiki table cells
    ├── messagebus.ts       # Typed chrome.runtime message wrappers
    ├── formatters.ts       # GP and XP number formatters, label maps
    ├── riskKeywords.ts     # Canonical wilderness/risky keyword lists
    └── __tests__/
        └── filterEngine.test.ts  # Unit tests for all filter functions

background.js               # MV3 Service Worker: handles cross-origin API fetching,
                            # rate-limit backoff, caching, and background push updates
manifest.json               # Manifest V3 configuration
```

---

## Architecture Notes

### Why a background service worker for API calls?
Chrome extensions cannot make cross-origin requests from content scripts. All external API calls (wiki, prices, hiscores) are routed through `background.js` via `chrome.runtime.sendMessage` to avoid CORS blocking.

### Why Shadow DOM?
The OSRS Wiki uses aggressive global CSS that would break any injected panel. Shadow DOM creates an isolated style scope for the filter panel while allowing our chips to be injected into the wiki's own table rows (where the wiki's CSS applies normally, as intended).

### Why `row.style.display` for filtering?
The wiki uses a JavaScript-based table sorter that depends on DOM order. Any attempt to remove, reorder, or clone rows would break sorting. We exclusively toggle `row.style.display = 'none'` to filter, which keeps the native sorter completely intact.

### Caching strategy
The background worker maintains a 6-hour `chrome.storage.local` cache (`mmgCache_v8`). On any page load, the content script first receives the cached result immediately (< 5ms), then background processing fills in any missing or stale entries and pushes incremental updates to the tab.

---

## Privacy

This extension collects no personal data. See the full [Privacy Policy](./PRIVACY_POLICY.md).

**Summary:**
- Filter preferences are saved locally in your browser only
- Your RSN is only ever sent to public hiscores APIs (Wise Old Man / Jagex), and only when you explicitly click **Lookup**
- Wiki financial data requests are anonymous (page titles / item IDs only)
- No analytics, no telemetry, no tracking

---

## Contributing

Contributions are welcome. Please open an issue before making large changes so we can discuss the approach first.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature-name`
3. Make your changes and run `npm run check && npm test`
4. Open a pull request

---

## Disclaimer

This project is not affiliated with, endorsed by, or connected to Jagex Ltd or the OSRS Wiki. "Old School RuneScape" is a trademark of Jagex Ltd.

---

## License

GNU Affero General Public License v3.0 (AGPL-3.0) — see [LICENSE](./LICENSE) for details.

