# Renoweet Focus Hub v3.9

- Invoice numbering changed to `YYYY-MMNNN`, where `MM` is invoice month and `NNN` is the sequence inside that calendar quarter. Sequence resets to `001` at each new calendar quarter.
- Number generator considers known OS and Bookkeeping invoices when the yearly canonical Drive file has been loaded.
- Added controlled one-time 2026 Q3 migration page for the attached legacy workbook.
- Migrates 10 invoice-backed projects + 1 quotation-only project to OS, and 10 invoice rows to Bookkeeping.
- Legacy invoice numbers are remapped to 2026-07001 … 2026-08010 and preserved in notes.
- Payment status remains Unknown for manual review.
- Expenses are intentionally not auto-imported because the source sheet mixes business and potentially personal rows.
- Import is idempotent, duplicate-aware, checksum-verified and forces Drive Recovery before section saves.
