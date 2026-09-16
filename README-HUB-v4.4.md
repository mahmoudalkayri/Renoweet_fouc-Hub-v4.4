# Renoweet Focus Hub v4.4.1

v4.4.1 makes the selected quarter authoritative across the Bookkeeping dashboard, Sales, Expenses, Reports, VAT, Control and printed registers. It also separates supplier invoices, insurance contributions, actual Renoweet cash paid, deductible VAT and net business cost.

## Focus Hub database

- Focus Hub goals, metrics, reminders, today’s focus and expense-optimizer records save automatically to the private hosted database.
- Existing browser data is migrated into the database the first time the upgraded Hub loads.
- A browser copy remains available for offline work and synchronizes after reconnecting.
- JSON export/import remains available as a user-controlled backup.
- OS, Bookkeeping and BOD business records continue to use their existing Google Drive database.

## Accounting core

- Issued revenue, customer cash, receivables, deductible costs and VAT are calculated independently.
- Dashboard, VAT, Reports and Control use the same canonical formulas.
- Invoices use line items with quantity, net unit price and VAT rate.
- Draft invoices have no permanent number. Issuing allocates the number; issued numbers are immutable.
- Customer payments are separate records and support partial payment.
- Credit notes reduce revenue, output VAT and receivables without deleting the issued invoice.
- General, fuel and vehicle entries appear in one expense ledger and calculation path.
- Expenses store invoice VAT, deductible VAT percentage, deductible VAT, income-tax deductible percentage and deductible cost separately.
- Insured expenses store the insurer contribution, payment route, actual business payment, insurer and claim reference without reducing the supplier invoice VAT.
- The selected quarter filters on-screen invoices, payments, expenses, receivables, health controls and reports, not only printed output.
- Permanent Record IDs link invoices, expenses, payments, credit notes and proofs.
- The Accounting Health score checks missing proof, VAT mismatches, duplicate invoice numbers, overdue/partial invoices and unallocated payments.

## Compatibility

Existing v4.3 records are read without a destructive conversion. Legacy Paid invoices still count as received cash until an explicit payment record exists. Legacy Parking and Other values are presented as separate invoice lines while keeping the stored invoice total and VAT intact. New v4.4 fields are saved into the same yearly Google Drive JSON and included in JSON/XLSX archives.

Open `index.html`, then choose **Bookkeeping**. Connect Google Drive as before.

## Project-save and Drive identity recovery update

- The manifest's exact `activeFileId` is authoritative for each yearly database.
- Only `Renoweet-YYYY.json` inside `Renoweet Data/Active` is treated as live; same-named files elsewhere are reported and ignored.
- Duplicate live databases, manifests, or Renoweet data folders stop safely instead of selecting the newest-looking copy.
- Project forms write a protected local draft on every input/change and whenever the page is refreshed, hidden, or closed.
- The Save button verifies the exact Project ID in the browser safety database before closing the editor.
- Google Drive synchronization runs after the local save, shows a separate verified/pending state, and retries interrupted saves after reconnecting.
- Existing Google authorization is reused after a refresh when the browser session still holds a valid token.
- Every invoice renderer shows `Rekeninghouder: Mahmoud Idris` with IBAN `NL45INGB0111929547`.
- OS > Database can install a verified merged recovery JSON. It checks the exact source checksum, creates a Drive Recovery snapshot, and refuses to overwrite a live database that changed after the merge was prepared.
- OS > Database includes a quarter-controlled Legacy XLSX Import workflow. It previews invoices, projects and expenses, creates deterministic internal IDs, treats invoice numbers as duplicate controls, skips records already present, and creates Drive recovery snapshots before importing OS or bookkeeping data.
- Single-project JSON restore remains available under Advanced recovery for isolated lost-project cases; it is no longer the primary migration workflow.
