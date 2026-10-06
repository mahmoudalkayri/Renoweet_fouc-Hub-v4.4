# Renoweet Focus Hub v4.4.4

## Nextgenhome doorlopende-post exceptions — 6 October 2026

The owner confirmed that parking on invoices **2026-0101001** (1 January 2026) and **2026-0402003** (4 February 2026) is a genuine doorlopende post. Only untaxed parking on these exact invoice numbers is excluded from the historical 21% parking calculation. Other invoices, including other Nextgenhome invoices, retain their existing treatment.

The parking review lists the two configured exceptions and any matching amounts found in the loaded year. The VAT rate table shows them separately as **Doorlopende posten — niet in 1a / 1b / 1e**, excluding them from that table's turnover total. Work VAT remains included. Original invoice subtotal/gross, payments, receipts and expense records are preserved; this does not migrate supplier expenses or change sent invoice documents. The original revenue/expense ledger is preserved, while the return's turnover display separates these disbursements.

Reload the updated Hub and load the full 2026 year from Drive before using the recalculated Q1 VAT position. Previously quoted Q1 differences and combined payment estimates must be recalculated after this exception.


## Historical parking calculation — 6 October 2026

In Bookkeeping → VAT, **Historical parking correction** reviews all loaded 2026 invoices from 1 January through 6 October, including Q1 and Q2. Load the full 2026 year from Drive so the review can include every invoice. Use the invoice list to compare original and calculated net / VAT figures; the quarter table shows the VAT differences after identifiable proportional credits.

Untaxed parking reimbursements are treated as VAT-inclusive at 21%, preserving the customer's invoice total. Example: €100 work + €21 VAT + €30 parking becomes €124.79 net + €26.21 VAT = €151. A €732 parking reimbursement becomes €604.96 net + €127.04 VAT. The split applies only to parking, leaving work rates and other costs intact.

The engine calculates on copies. Original issued invoice records and previews, OS snapshots, payments, supplier parking expenses, receipt VAT, saving and invoice-opening workflows remain intact. Sales, VAT, profit, annual planning and BOD use the calculated net / VAT figures. This calculation does not create an extra expense for output VAT or invent input VAT on parking receipts.

Already taxed parking is not retaxed. Unknown invoice status, inconsistent original totals, special treatments including reverse charge, and ambiguous old final-invoice deductions / credits appear for individual review. Identified source parking lines on partial and final invoices retain their signed deductions. Old XLSX work lines that omitted separate parking fields are reconciled against the stored invoice total before those recharges are included.

The correction is a historical calculation overlay, not a change to invoices already sent or a filed tax return. Past-quarter differences are shown in their original periods, not automatically added to the current quarter. Cash-basis reports continue using dated payments; the parking review's quarter comparison uses invoice VAT dates. Future invoices after 6 October are outside this historical adjustment.

Validation: all 18 regression suites pass, including the original navigation/reopening and save-protection suites. New coverage checks fixed grand totals, original-record preservation, expenses, mixed rates, partial/final deductions, credits, period boundaries, cash-basis recognition, actual VAT/preview rendering and BOD calculations. Browser engine loading also works without a separately loaded parking asset because the engine is bundled in the accounting script.


## Correcting an unissued partial draft — 1 October 2026

- Print/PDF validates a partial draft without marking it issued or locking it.
- For a draft locked by an earlier Print/PDF action, use Concept heropenen. Confirm that it was never sent or booked. The old snapshot is archived and its number, amount and payment details are preserved. Sent/shared/queued invoices and invoices already in Bookkeeping cannot use this draft action.
- Use BTW wijzigen in Estimate to open the original work lines. Set the painting line to 9% and the flooring line to 21%, then return to Invoice. The partial allocation will use those source rates.
- Legacy lines containing a stored 9% rate retain it even when their treatment field is missing.
- Partial invoice rows describe each work line separately; an optional extra description appears once in the document note.


## BTW allocation for partial invoices — 1 October 2026

- In OS, open Invoice, choose Nieuwe deelfactuur, and enter the amount actually received using Inclusief BTW.
- The estimate lines show their BTW rate, total, previously invoiced amount, remaining balance and allocation to this instalment.
- Laagste BTW eerst is the default: it clears the lowest-rate remaining lines before allocating to the next rate. You can choose Hoogste BTW eerst, Naar verhouding, or Zelf verdelen per regel. Custom line amounts must add up to the instalment and cannot exceed a line balance.
- Each instalment retains its exact source lines, net amount and BTW. Further instalments use only the remaining balances; the final invoice deducts the recorded amounts. Already issued invoices retain their original snapshots.
- Example: €1,120 at 9% plus €2,430 at 21% totals €4,161.10. A €2,080.55 advance clears €1,220.80 at 9% and applies €859.75 to the 21% line. Its BTW is €100.80 + €149.21 = €250.01.


## Additional review fixes — 1 October 2026

- New partial and final invoice drafts use their new fields and invoice numbers immediately.
- An unchanged open editor no longer manufactures repeated saves. Genuine edits made during saving are captured and verified.
- Failed reverse-charge validation leaves the invoice editable; duplicate numbers already in Bookkeeping are blocked.
- Cent allocation across mixed VAT groups cannot create a negative partial line through rounding.

## Invoice and save fixes — 1 October 2026

- Invoice opens even when a partial-invoice draft has no amount yet or has an amount that needs correction. Enter a valid amount before issuing it.
- Edits and payments entered while a Drive save is running remain protected locally and are queued for the next verified save.
- Saves reuse folder/database checks within each operation and skip uploads when the data is unchanged. Fresh identity/revision checks, uploaded checksum verification, closed-period protection and recovery snapshots remain enabled.
- To issue an advance invoice: open the OS project, select Invoice, choose a new partial invoice, enter the amount and issue it. The first partial uses the base invoice number followed by .01. Send that issued invoice to Bookkeeping.


## Mixed BTW rates in OS quotations

- Every Estimate work line now has its own 21%, 9%, BTW verlegd (21% or 9% reference rate), or 0%/vrijgesteld choice.
- Quotation and invoice previews show the BTW treatment beside every line and split the BTW summary by treatment.
- The project-wide BTW selector is now a default for new or legacy lines and for travel; it no longer replaces explicit line choices.
- Line-level BTW data is stored in the OS XLSX, retained in backups, and transferred to Bookkeeping through Line items JSON.
- Mixed documents keep their 21%, 9%, reverse-charge and zero-rated portions separate in Bookkeeping and reports.
- A customer BTW ID is required before a quotation or invoice containing a BTW-verlegd line can be issued, printed, or sent.

## Annual Income Tax Pack

The Reports tab now includes a year-end workspace that keeps the annual tax-preparation records beside the quarterly bookkeeping:

- fixed assets with annual depreciation and closing book value;
- finance leases with cash payment, interest expense, principal repayment and closing debt separated;
- owner deposits and private withdrawals outside business costs;
- 31 December bank, cash, VAT, other assets/liabilities and opening-equity inputs;
- a bank reconciliation and balance-sheet difference check;
- vehicle-use kilometres and a no-private-use evidence confirmation;
- a Dutch-return mapping for revenue, materials, outsourced work, vehicle costs, other costs, assets, liquid funds, receivables, lease debt and private movements.

These records are included in the verified Drive JSON, browser/XLSX backups, year archives, checksums and audit counts. The pack is a preparation and control aid, not an official tax assessment.

Compatibility fix: existing checksummed yearly databases are now authenticated in their original stored shape before the new Tax Pack collections are added. This allows a valid pre-Tax-Pack Drive database to open safely while genuine checksum changes remain blocked.

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

## Year-first Drive organization and BOD reading update

Open **OS → Database → Organize year** to preview and confirm moving the verified live JSON and existing expense proof folders into `Renoweet Data/YYYY`. The action writes and verifies a Recovery copy of the exact live JSON first, preserves all Drive file IDs, checks the live checksum after moving, and leaves old folders in place. Until this action runs, OS and Bookkeeping continue to read the authoritative file in the legacy `Active` folder. New receipts upload directly to `Renoweet Data/YYYY/Proofs/Q#`.

BOD now separates issued net sales by invoice date, net value of fully settled invoices, and gross customer cash by payment date. Its monthly graphs include zero-activity calendar months. `company-details.txt` controls the company identity and payment details displayed by new quotes, invoices and reports after deployment.

## Bookkeeping-only advance corrections

For a partial invoice sent only to Bookkeeping, save its corrected line items there. In OS, update the actual work-line rates under Estimate, open the original partial invoice and choose **Bookkeeping-correctie overnemen**. The action reads the latest verified Drive database and previews the net, VAT and gross amounts. Confirm that the invoice was never sent to the customer. It archives the old OS document and queue, preserves the invoice number and all existing payment entries, and updates the OS advance from Bookkeeping without sending or reimporting another payment. It requires the same gross amount and matching work-line VAT balances; sent/shared invoices, credits, changed projects and dependent later documents are blocked. Corrections in a closed quarter must first be saved through Bookkeeping's existing correction/reopen workflow.

Do this before another instalment. For a quote of 1120 net at 9% plus 2430 net at 21%, the first gross advance of 2080.55 has line nets 1120 and 710.54, with VAT 100.80 and 149.21 (250.01 total). The next gross instalment of 2000 has VAT 347.11. A final gross balance of 80.55 has VAT 13.98. The whole project reconciles to gross 4161.10 and VAT 611.10.

Create the next instalment with **Nieuwe deelfactuur (.01, .02…)**, enter its amount including VAT and record its received date/method if already paid. Send it to Bookkeeping and import it there once; the payment importer is idempotent. If a payment settles an invoice already in Bookkeeping, use that invoice's **Payment** action instead of creating an additional invoice. Do not enter an already-imported advance payment again.

## Definitive final invoices

**Eindfactuur / resterend bedrag** now produces an **EINDFACTUUR** with a definitive closing statement in OS and Bookkeeping previews and PDFs. Its separate summary shows the indicative estimate captured with the first instalment (when available), final actual project total, each earlier invoiced instalment, and the amount on the final invoice. Invoiced instalments are not labelled paid; unsettled instalments remain separate payment obligations. Only the final invoice's remaining amount and VAT enter Bookkeeping.

Before issuing, update quantities and amounts in **Estimate** to the actual work/materials. Use **Definitieve werkzaamheden / materialen** to edit the final invoice's line descriptions without rewriting the earlier partial invoices or the estimate descriptions. The closing statement is frozen when issued. Existing final snapshots display their stored totals and deductions; a missing historic estimate is omitted rather than guessed. Partial invoices label the project total as estimated, with the definitive total to follow on the final invoice.

## Invoice reopening reliability fix

The closing renderer is bundled into both invoice UI scripts instead of requiring a separate display-script download. This fixes the reproduced final-invoice crash when that asset is unavailable. The relevant scripts and offline cache now use matching release URLs, avoiding an old invoice engine being combined with a new invoice UI. Read-only invoice previews tolerate a previous engine version; issuing stops with a reload instruction when versions differ. Legacy projects without invoice settings are initialized safely when their invoice screen is opened.

The new navigation test executes the actual OS intake/save/tab/history functions with a DOM test surface. It checks repeated close/reopen cycles, partial and frozen final history, missing display assets, mixed cached scripts, absent legacy invoice settings and reopening after payment. All 16 suites, including 1,000 mixed-VAT instalment/final reconciliations, pass. No live financial records are changed by this source update.
