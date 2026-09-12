# Renoweet Focus Hub v4.4

v4.4 upgrades Bookkeeping from independent dashboard formulas to one shared accounting engine while preserving the v4.3 Drive, proof, recovery, quarter-locking and archive workflows.

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
- Permanent Record IDs link invoices, expenses, payments, credit notes and proofs.
- The Accounting Health score checks missing proof, VAT mismatches, duplicate invoice numbers, overdue/partial invoices and unallocated payments.

## Compatibility

Existing v4.3 records are read without a destructive conversion. Legacy Paid invoices still count as received cash until an explicit payment record exists. Legacy Parking and Other values are presented as separate invoice lines while keeping the stored invoice total and VAT intact. New v4.4 fields are saved into the same yearly Google Drive JSON and included in JSON/XLSX archives.

Open `index.html`, then choose **Bookkeeping**. Connect Google Drive as before.
