# Renoweet Focus Hub v3.0

## Added: yearly navigation in OS and Bookkeeping

- Current active year remains editable.
- Earlier `Renoweet-YYYY.json` databases appear in a Year selector.
- Historical years load from Google Drive in **READ ONLY** mode.
- Historical mode blocks saves, bookkeeping sync, quarter close/reopen and year-final actions.
- Existing yearly JSON architecture is unchanged: one live JSON database per calendar year.
- XLSX remains archive/recovery/export, not the live working database.

The selector is populated from the Renoweet manifest plus accessible yearly JSON files in Drive.
