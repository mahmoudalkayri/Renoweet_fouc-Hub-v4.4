# Renoweet Drive Architecture — Build v2.2

This is the hardened storage build for Renoweet OS, Bookkeeping and BOD. It keeps the existing application interfaces as much as possible while changing the live database from continuously rewritten XLSX files to one validated JSON database per year in the owner's Google Drive.

## Folder structure

```text
Renoweet Data/
├── Renoweet-manifest.json
├── Active/
│   └── Renoweet-2026.json
├── Recovery/
│   └── rotating Renoweet-2026-rXXXXXX-<timestamp>.json snapshots
└── Archives/
    ├── Renoweet-2026-Q1.xlsx
    ├── Renoweet-2026-Q2.xlsx
    ├── Renoweet-2026-Q3.xlsx
    ├── Renoweet-2026-Q4.xlsx
    ├── Renoweet-2026-FINAL.xlsx
    └── Renoweet-2026-FINAL.json
```

## What v2 adds

1. **Schema validation + SHA-256 integrity** — the live JSON includes schema version, revision, record count and checksum. A checksum failure stops loading/saving rather than overwriting the file.
2. **Rotating Drive recovery snapshots** — the previous valid database is copied into `Recovery` before risky/manual saves and periodically during normal work. The newest 20 recovery snapshots per year are kept.
3. **Stable internal IDs** — projects, customers, project line items, invoices, expenses, fuel, automobile and deleted bookkeeping records receive permanent internal IDs. Existing IDs are preserved.
4. **Financial audit trail** — creates/updates/deletes to bookkeeping records produce audit events with timestamp, record ID, period and device ID. Quarter close/reopen and period-status changes are also audited.
5. **Real quarter locking** — Q1–Q4 are stored as period objects in the annual JSON. Once a quarter is closed, changes to financial records dated in that quarter are rejected by the storage layer. Reopening requires an explicit action and reason and does not modify the previous archive.
6. **Quarter selector in Bookkeeping** — the annual live database remains one file, while BTW reports can work against Q1, Q2, Q3 or Q4. Filing status is stored per quarter rather than depending on a quarterly XLSX filename.
7. **Reconstructable XLSX archives** — exports include Summary, Customers, Projects, Estimate Items, Materials, Documents, Payments, Purchase Orders, Activity, FollowUps, Checklist, Invoices, Expenses, Fuel, Auto, Bookkeeping, Deleted, Bookkeeping Control, Periods, Audit, Archive Metadata and a chunked Canonical JSON sheet.
8. **Manifest** — `Renoweet-manifest.json` identifies the active year/file and records quarterly/final archive file IDs and checksums. BOD uses it to find the current database and up to three previous final archives.
9. **One-click complete offline backup** — OS and Bookkeeping can download one ZIP containing the exact JSON database, reconstructable XLSX, manifest and a short README.
10. **Local safety copy remains** — each device continues to keep an IndexedDB/browser safety snapshot in addition to Drive recovery copies.

## Bookkeeping period behavior

The live file is annual. The Bookkeeping page now exposes a Q1–Q4 selector. `Close BTW quarter` creates an XLSX snapshot, records it in the manifest, and changes that quarter to `closed` in the JSON. The storage layer blocks later invoice/expense/fuel/auto edits dated in a closed quarter. `Reopen quarter` records the reason in the audit trail and keeps the old archive unchanged.

The current Bookkeeping interface still contains some legacy wording referring to quarterly workbooks. The v2 adapter redirects the critical quarter selection, close/reopen and filing-status behavior to the annual JSON model. The old XLSX import/report helpers remain available for migration and historical work; XLSX is not the live database.

## BOD behavior

BOD is read-only. It validates and loads the active yearly JSON, reads the manifest, and then loads up to the previous three `FINAL.xlsx` archives. It can still add a local XLSX manually. BOD never writes business data back to the live database.

## Google setup — once

1. Create a Google Cloud project for Renoweet.
2. Enable Google Drive API.
3. Configure Google Auth / OAuth consent for the owner's Google account.
4. Create an OAuth 2.0 **Web application** client ID.
5. Add the HTTPS origin where the Renoweet pages are hosted under Authorized JavaScript origins.
6. Put all files from this package together on that origin.
7. Open OS or Bookkeeping and connect. This v2.2 package already contains the Renoweet OAuth Web Client ID, so you should not need to paste it manually on each device.

The app uses `drive.file`; no Google client secret is embedded in the HTML. The OAuth Web Client ID is a public identifier and is preconfigured as `819845217406-569349vod25m15sb2omm03do2h1ll976.apps.googleusercontent.com`.

## Safe migration sequence

Do not overwrite the current production pages yet.

1. Host v2 in a separate test location.
2. Connect OS and create/load the current year's JSON.
3. Connect Bookkeeping to the same account/year.
4. Confirm OS and Bookkeeping totals against the current working files.
5. Confirm BOD shows the same live totals.
6. Test on a second device and deliberately test a same-section conflict.
7. Create a test complete ZIP backup and open the XLSX.
8. Close a test quarter only with disposable/test data and confirm a dated financial edit is blocked afterward.
9. Test reopen and audit behavior.
10. Only after these tests should v2 replace the working pages.

## Old 2026 XLSX migration

Older 2026 workbooks can have a completely different structure. They should be handled separately: extract useful invoices/expenses/fuel/auto data, normalize it, assign stable IDs, detect duplicates, compare totals, preview the result, and only then commit it to the annual JSON. Never point the live storage layer directly at an old XLSX workbook.

## Files

- `Renoweet-OS-Drive-v2.2.html`
- `Renoweet-Bookkeeping-Drive-v2.2.html`
- `Renoweet-BOD-Drive-v2.2.html`
- `renoweet-drive-core-v2.2.js`
- `renoweet-os-drive-adapter-v2.js`
- `renoweet-bookkeeping-drive-adapter-v2.js`
- `renoweet-bod-drive-adapter-v2.js`
- `renoweet-year-schema-example-v2.json`

## Important testing limitation

This build has been syntax-checked and its local integrity functions have been tested without a Google account. It has **not** been end-to-end tested against your real Google Drive/OAuth configuration. Keep the existing production system until the Google Drive test sequence above passes.


## v2.2 change

The Renoweet Google OAuth Web Client ID is preconfigured in the shared Drive core and in the OS Google Calendar integration. Browser-local override remains possible through Drive settings if the OAuth client ever changes in the future.
