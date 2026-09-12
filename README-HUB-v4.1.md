# Renoweet Focus Hub v4.1

- Q3 2026 safe migration now includes the user-approved expense data from Renoweet_Boekhouding.xlsx.
- Imports 56 general expense rows, 7 fuel rows and 2 automobile rows, in addition to the legacy invoices/projects.
- 21 source rows marked Review remain flagged for manual review after import.
- Missing receipt/file references remain blank; no proof is invented.
- Duplicate protection uses migration keys plus transaction fingerprints (date, supplier, gross, category/description).
- Forced Drive Recovery snapshot remains enabled before OS and Bookkeeping migration saves.
