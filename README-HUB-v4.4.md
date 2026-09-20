# Renoweet Focus Hub v4.4.4

## Accounting improvements

- Select invoice-basis (`factuurstelsel`) or cash-basis (`kasstelsel`) VAT reporting; invoice-basis remains the safe default.
- Received `BTW verlegd` expenses now show the reverse-charge VAT due and deductible input VAT separately instead of behaving like ordinary 0% expenses.
- Credit notes preserve mixed VAT-category proportions, including taxable, reverse-charge, and 0% lines.
- Q4 supports a reviewed private-use vehicle VAT correction, and Reports supports period depreciation and signed profit adjustments.
- Cash reporting now labels supplier cash paid and net movement clearly, and explains that the result is not a bank balance or free-cash figure.
- Reports now include a year-wide income-tax planning card that combines all four quarters, totals depreciation and adjustments, and tracks a configurable tax reserve against provisional tax already paid.
- The report tables reserve separate space for descriptions and euro amounts so long labels no longer collide with values on narrower screens.
- This tailored build opens on cash-basis VAT reporting unless the user explicitly saves invoice basis.

v4.4.4 keeps the selected quarter authoritative across the Bookkeeping dashboard, Sales, Expenses, Reports, VAT, Control and printed registers. It also separates supplier invoices, insurance contributions, actual Renoweet cash paid, deductible VAT and net business cost.

## Auto & Fuel quarter consistency

- Auto & Fuel now follows the selected quarter and sorts the newest expenses first.
- Fuel and Automobile chosen from the main Expenses form are saved to their matching ledgers and appear in Auto & Fuel immediately.
- Older Fuel/Vehicle entries accidentally stored under General remain visible in the correct Auto & Fuel section and move safely to the matching ledger when edited.

## Project Notebook integration

- The Hub now includes **Project Notebook**, a bilingual site-survey and scope-confirmation tool with filled-report and blank-paper printing.
- Creating or duplicating a notebook project creates one linked Renoweet OS project with a permanent OS Project ID.
- Project Notebook also lists open OS projects whose stage is **Lead** and that have not been queued to Bookkeeping. Select **Work in notebook** to open an existing OS lead without creating a second OS project.
- Duplicate protection uses the permanent OS Project ID first. Manual notebook creation also reuses an exact open OS lead match on project title plus customer or address instead of creating a duplicate.
- Notebook scope, survey checks, measurements, notes, planning and confirmation metadata are stored under the linked OS project's `siteSurvey` contract-basis snapshot. Later notebook saves update that survey/scope data while preserving OS estimates, materials, payments, invoice data and the OS execution checklist.
- The link writes through the existing OS browser safety database and queue. When Renoweet OS is open it accepts updates immediately; otherwise it accepts them on the next OS load and then follows the normal Drive save path.
- OS keeps its existing Google Drive merge, verification, retry and recovery behavior. The notebook does not replace or bypass those safeguards.
- Notebook photos remain local, are included in its JSON backup and are limited to 10 per project. Adding beyond the limit requires confirmation before the oldest photos are removed.
- Deleting a notebook does not delete the linked OS project.

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


## v4.4.4 payment-timing reconciliation

The dashboard now separates **Paid against Qx invoices** from **Cash received in Qx**. A green Paid invoice can legitimately have zero outstanding while its customer payment is dated in a later quarter; previously that difference was mathematically correct but visually confusing. Sales now shows any portion of an invoice paid outside the selected quarter, adds a Payment timing section with those rows, and lets you edit the payment date through the controlled closed-quarter correction workflow. The dashboard calculation also shows payments applied inside/outside the selected quarter so the cash figure can be traced directly to the dated cash ledger.

## v4.4.2 closed-quarter payment correction fix

- The header **Reopen Qx** button now calls the quarter action without accidentally passing the browser click event as the quarter number. This fixes the no-op reopen/close button behavior.
- Imported invoices marked Paid are no longer auto-migrated into a closed quarter and left only in the browser. Closed-period payment mismatches stay visible until they are deliberately repaired.
- Payment repair, payment edit/removal, and saving a Paid imported invoice can reopen only the affected quarter(s), including a correction that crosses Q1 and Q2. Each reopen is written to the existing audit trail and old quarter archives remain unchanged.
- After a correction, closing the quarter creates a replacement archive while retaining prior archive metadata in history.
- Closed-period protection now checks both the old and new record dates, so moving a record out of a closed quarter cannot bypass the lock.
