# Renoweet Focus Hub v4.0

- Invoice numbering uses `YYYY-DDMMNNN`. Example: 10 June, first sequence = `2026-1006001`.
- Sequence continues across the special June–September 2026 period and resets for Oct–Dec.
- Existing legacy invoice numbers are preserved exactly during Q3 migration.
- Migration remains preview-first with duplicate checks and forced Drive Recovery snapshots.
- `Renoweet_Boekhouding.xlsx` is treated as the stronger bookkeeping source; the prior Q3 source can still supply project-only information not present in it.
