# Chrome Web Store Submission Reference

This document captures everything needed when submitting or updating the extension
on the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## 1. Extension Identity

| Field | Value |
|---|---|
| **Name** | OSRS Money Making Filter |
| **Version** | 1.0.0 |
| **Category** | Productivity |
| **Language** | English |

---

## 2. Short Description (132 char max)

```
Filter the OSRS Wiki money making guide by intensity, budget, ROI margin, risk level, and your in-game skill stats.
```

---

## 3. Detailed Description

```
OSRS Money Making Filter adds a powerful filtering panel directly above the OSRS Wiki Money Making Guide table, letting you cut through hundreds of methods and surface exactly what suits your playstyle.

FEATURES

• Intensity Filter — show only AFK/Low, Moderate-or-lower, or High-intensity methods
• Max Budget — hide methods requiring more hourly supply capital than you have (e.g. < 100k, < 1M, < 5M, < 10M GP)
• Min Margin (ROI) — show only methods with > 15% or > 50% return on investment relative to input cost
• Hide Wilderness / PvP — automatically exclude methods in dangerous areas
• Hide Risky / Volatile — exclude methods with unstable prices or slow GE resale
• Skill XP Filter — filter by methods that grant XP in a specific skill (Agility, Magic, Slayer, etc.) at a minimum XP/hr rate
• Player Stats Lookup — enter your in-game name to look up your skill levels via public hiscores, then auto-hide methods your character can't access yet
• Per-Method Hide Buttons — click the × on any row to exclude a specific method, with easy restore from the status bar
• Live Financial Chips — each method row shows colour-coded ROI %, input cost, GE trade volume, and XP/hr badges fetched live from the OSRS Wiki
• Three Theme Support — adapts automatically to OSRS Wiki Light, Dark, and Browntown colour schemes
• Persistent Settings — all your filter preferences are saved locally in your browser and restored on every visit

HOW IT WORKS

The extension injects a filter panel above the wiki table. It uses the official OSRS Wiki API to fetch live financial data for each money-making method (input costs, profit margins, risk warnings, XP gained). Data is cached locally for 6 hours to keep requests lightweight.

All data is sourced from public APIs. Nothing is tracked. No account required.

SOURCE CODE

This extension is fully open-source. You can inspect every line of code at:
https://github.com/StylianosGakis/osrs-mmg-filter

DISCLAIMER

This extension is not affiliated with, endorsed by, or connected to Jagex Ltd or the OSRS Wiki.
```

---

## 4. Permission Justifications

These justifications must be entered in the Developer Dashboard under **"Why does your extension need these permissions?"**

### `storage`
> Used to save the user's filter preferences (intensity, budget, ROI, risk toggles, excluded methods, skill XP settings) locally in the browser across sessions. Also used to cache OSRS Wiki financial data (input costs, profit margins, risk flags, XP rates) for up to 6 hours to avoid redundant network requests on page reload. No data ever leaves the user's device via this permission.

### Host Permissions Justification (Combined, max 1000 characters)
```
Host permissions are required to fetch public OSRS financial and player stat data needed to filter money-making guide methods:

1. oldschool.runescape.wiki & *.runescape.wiki (OSRS Wiki MediaWiki & Prices APIs):
Used to fetch financial metrics (input costs, profit margins, XP rates, risk warnings) and 24h item trade volumes for guide methods. Triggered when the user clicks "Load Data". Requests use public page titles/item IDs only; results are cached locally for 6 hours.

2. api.wiseoldman.net & secure.runescape.com (Wise Old Man & Jagex Hiscores APIs):
Used strictly when the user enters an in-game name (RSN) and clicks "Lookup". Fetches public skill levels (Wise Old Man with fallback to official Jagex Hiscores) to hide methods above the player's level.

All host requests are read-only, user-initiated, and fetch only public game data needed for filtering. No personal user data or telemetry is collected, transmitted, or stored remotely.
```

---

## 5. Privacy Policy URL

Host this policy as a raw GitHub URL after publishing the repository:

```
https://github.com/StylianosGakis/osrs-mmg-filter/blob/main/PRIVACY_POLICY.md
```

Or use a GitHub Pages URL if you set that up later.

---

## 6. Single Purpose Statement

> The single purpose of this extension is to filter and annotate the OSRS Wiki Money Making Guide table. It adds a filter panel that lets players narrow down money-making methods by effort level, supply capital required, profit margin, risk, XP gained, and their own character's skill levels.

---

## 7. Store Listing Assets

| Asset | Requirement | Notes |
|---|---|---|
| **Icon 128×128** | Required | `icons/icon128.png` (already in repo) |
| **Promotional tile 440×280** | Required for listing | Create a simple tile: dark OSRS-themed background, extension name, a screenshot of the filter panel |
| **Screenshots (1280×800 or 640×400)** | At least 1 required | Take a screenshot of the filter panel on the wiki page, ideally showing chips + filtered rows |
| **Small promo tile 920×680** | Optional (featured) | Not needed for initial submission |

> **Tip:** Screenshots are the most important conversion factor. Show the panel with filters active, chips visible on rows, and some rows hidden to demonstrate the value clearly.

---

## 8. Store Zip Package

Build and package with:

```bash
npm run build
cd dist
zip -r ../osrs-money-making-filter-v1.0.0.zip .
```

Then upload `osrs-money-making-filter-v1.0.0.zip` in the Developer Dashboard.

> ⚠️ Upload the **contents** of `dist/` — not the `dist/` folder itself. The `manifest.json` must be at the root of the zip.

---

## 9. Pre-Submission Checklist

- [ ] `npm run check` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] `npm test` passes (27/27)
- [ ] `dist/manifest.json` present with version `1.0.0`
- [ ] `dist/background.js` present
- [ ] `dist/content.js` present
- [ ] `dist/icons/icon16.png`, `icon48.png`, `icon128.png` all present
- [ ] Privacy Policy URL resolves publicly (GitHub repo must be public)
- [ ] Developer Dashboard: single purpose statement filled in
- [ ] Developer Dashboard: all 5 host_permission justifications filled in
- [ ] At least 1 screenshot uploaded (1280×800)
- [ ] Promotional tile 440×280 uploaded
