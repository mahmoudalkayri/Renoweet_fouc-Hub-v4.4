# Renoweet Focus Hub v4.4.3

v4.4.3 keeps the selected quarter authoritative across the Bookkeeping dashboard, Sales, Expenses, Reports, VAT, Control and printed registers. It also separates supplier invoices, insurance contributions, actual Renoweet cash paid, deductible VAT and net business cost.

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
- Cash received comes only from dated customer-payment records. Older Paid invoices with a paid date are migrated once into the payment ledger.
- Paid invoices with an incorrect existing payment are flagged with the exact difference and an audited repair action instead of being silently changed.
- Credit notes reduce revenue, output VAT and receivables without deleting the issued invoice.
- General, fuel and vehicle entries appear in one expense ledger and calculation path.
- Expenses store invoice VAT, deductible VAT percentage, deductible VAT, income-tax deductible percentage and deductible cost separately.
- Insured expenses store the insurer contribution, payment route, actual business payment, insurer and claim reference without reducing the supplier invoice VAT.
- The selected quarter filters on-screen invoices, payments, expenses, receivables, health controls and reports, not only printed output.
- Permanent Record IDs link invoices, expenses, payments, credit notes and proofs.
- The Accounting Health score checks missing proof, VAT mismatches, duplicate invoice numbers, overdue/partial invoices and unallocated payments.

## Compatibility

Existing v4.3 records are read without a destructive conversion. A legacy Paid invoice with a real paid date receives one explicit, idempotent payment record; a conflicting payment remains untouched until it is reviewed. Legacy Parking and Other values are presented as separate invoice lines while keeping the stored invoice total and VAT intact. New v4.4 fields are saved into the same yearly Google Drive JSON and included in JSON/XLSX archives.

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


## v4.4.3 payment-timing reconciliation

The dashboard now separates **Paid against Qx invoices** from **Cash received in Qx**. A green Paid invoice can legitimately have zero outstanding while its customer payment is dated in a later quarter; previously that difference was mathematically correct but visually confusing. Sales now shows any portion of an invoice paid outside the selected quarter, adds a Payment timing section with those rows, and lets you edit the payment date through the controlled closed-quarter correction workflow. The dashboard calculation also shows payments applied inside/outside the selected quarter so the cash figure can be traced directly to the dated cash ledger.

## v4.4.2 closed-quarter payment correction fix

- The header **Reopen Qx** button now calls the quarter action without accidentally passing the browser click event as the quarter number. This fixes the no-op reopen/close button behavior.
- Imported invoices marked Paid are no longer auto-migrated into a closed quarter and left only in the browser. Closed-period payment mismatches stay visible until they are deliberately repaired.
- Payment repair, payment edit/removal, and saving a Paid imported invoice can reopen only the affected quarter(s), including a correction that crosses Q1 and Q2. Each reopen is written to the existing audit trail and old quarter archives remain unchanged.
- After a correction, closing the quarter creates a replacement archive while retaining prior archive metadata in history.
- Closed-period protection now checks both the old and new record dates, so moving a record out of a closed quarter cannot bypass the lock.
