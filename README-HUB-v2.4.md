# Renoweet Focus Hub v2.4

This package combines the original Focus Hub concept with the current Renoweet Drive v2.2 apps.

## Hub functions
- Root `index.html` fixes the GitHub Pages 404 and acts as the control center.
- Launch tiles for CV/Profile, Renoweet OS, Bookkeeping and BOD.
- Rotating focus insights/reminders.
- July 2027 target and editable progress.
- Editable goals and metrics.
- Daily useful-action generator.
- Expense Optimizer and quick purchase/keep test.
- Local JSON export/import for hub-only goals/metrics/optimizer notes.
- Installable PWA with service worker.

## Data separation
The Focus Hub uses local browser storage for focus/goals/metrics/expense-optimizer notes. Renoweet business records remain in Google Drive and are handled only by OS, Bookkeeping and BOD.

## Compatibility
The hub intentionally keeps the old localStorage key `focusHubData_v1`, so existing Focus Hub data on the same GitHub Pages origin can continue to load.

## Publish
Upload every file and the `icons` folder to the root of the GitHub repository. GitHub Pages will open `index.html` at the repository root URL.
