# Privacy Policy — OSRS Money Making Filter

**Last updated:** August 2026

---

## Overview

OSRS Money Making Filter is a free, open-source browser extension. This policy explains what data the extension accesses, how it is used, and what it never does.

The source code is fully open and auditable at:
**https://github.com/StylianosGakis/osrs-mmg-filter**

---

## What Data Is Accessed

### 1. Filter Preferences (stored locally on your device)
The extension saves your filter settings to your browser's local extension storage (`chrome.storage.local`). This includes:
- Intensity, budget, margin, risk, and skill XP filter choices
- Any methods you have individually hidden (excluded methods list)
- Whether the "Filter by Stats" checkbox is enabled

This data **never leaves your device**. It is never sent to any server.

### 2. Player Username / RSN (stored locally, sent to public APIs on request)
If you choose to enter your in-game username (RSN) into the optional "RSN" lookup field and click **Lookup**, the extension sends your username to:

- **Wise Old Man API** (`https://api.wiseoldman.net/v2/players/username/<your-name>`) — a community-maintained, public read-only hiscores mirror
- **Jagex Official Hiscores API** (`https://secure.runescape.com/m=hiscore_oldschool/index_lite.json` and `index_lite.ws`) — used as a fallback if the Wise Old Man API doesn't have your data

These APIs are **public, read-only hiscores APIs** — the same data visible to anyone on the official OSRS Hiscores website. The extension retrieves your skill levels and stores them locally in `chrome.storage.local` for the "Filter by Stats" feature.

**Your RSN is only sent when you explicitly click the Lookup button. It is never sent automatically, in the background, or without your action.**

### 3. OSRS Wiki Page Data (fetched automatically when you click "Load Data")
When you click **Load Data**, the extension requests financial metrics and risk information for money-making methods from the official OSRS Wiki:

- **OSRS Wiki MediaWiki API** (`https://oldschool.runescape.wiki/api.php`) — fetches rendered HTML of individual money-making guide subpages to extract input costs, output values, risk warnings, and experience gained
- **OSRS Wiki Prices API** (`https://prices.runescape.wiki/api/v1/osrs/mapping` and `/24h`) — fetches publicly available Grand Exchange item trade volume data

These are **public APIs operated by the OSRS Wiki**. No personal data is sent — requests are anonymous and contain only page titles or item IDs. Fetched data is cached in `chrome.storage.local` for up to 6 hours to minimise repeated requests.

---

## What Data Is NOT Collected

- ❌ No personal information is collected, stored, or transmitted by us
- ❌ No analytics, telemetry, or usage tracking of any kind
- ❌ No cookies are set
- ❌ No data is sold, shared, or disclosed to any third party
- ❌ No account creation or sign-up is required or possible
- ❌ The extension does not track what methods you look at or how you use it
- ❌ Your RSN / username is never sent anywhere except the public hiscores APIs described above, and only when you explicitly initiate the lookup

---

## Third-Party Services

The extension communicates with the following third-party public services on an opt-in or on-demand basis:

| Service | URL | Purpose | Triggered by |
|---|---|---|---|
| Wise Old Man | `api.wiseoldman.net` | Player skill level lookup | Clicking "Lookup" |
| Jagex Hiscores | `secure.runescape.com` | Player skill level lookup (fallback) | Clicking "Lookup" |
| OSRS Wiki API | `oldschool.runescape.wiki` | Money-making guide financial metrics | Clicking "Load Data" |
| OSRS Prices API | `prices.runescape.wiki` | Grand Exchange trade volume data | Clicking "Load Data" |

Please refer to each service's own privacy policy for information about how they handle requests:
- [Wise Old Man Privacy Policy](https://wiseoldman.net/privacy)
- [Jagex Privacy Policy](https://www.jagex.com/en-GB/terms/privacy-policy)
- [OSRS Wiki Privacy Policy](https://runescape.wiki/w/RuneScape_Wiki:Privacy_policy)

---

## Local Storage

All data saved by the extension is stored exclusively in `chrome.storage.local` on your own device. You can clear all stored data at any time by:
1. Clicking **Clear Filters** in the extension panel (clears all filter preferences and stats)
2. Or by removing the extension entirely from `chrome://extensions/`

---

## Children's Privacy

This extension does not knowingly collect any data from or about children under the age of 13.

---

## Changes to This Policy

If this privacy policy changes materially, the updated version will be committed to the open-source repository at the GitHub URL above with a new **Last updated** date. Since there is no user account system, we cannot notify users directly — checking the repository is the best way to stay informed.

---

## Contact

This is an open-source community project. If you have privacy questions or concerns, please open an issue on the GitHub repository:

**https://github.com/StylianosGakis/osrs-mmg-filter/issues**

---

*This extension is not affiliated with, endorsed by, or connected to Jagex Ltd, the OSRS Wiki, or Wise Old Man.*
