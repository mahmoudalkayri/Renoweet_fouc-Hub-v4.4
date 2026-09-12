# Renoweet Focus Hub v4.3

Safe rebuild based on the working v4.1 package.

- Complete package includes the Google Drive core and all v4.1 Drive adapters. The main **Connect Google Drive** buttons keep the existing Google OAuth flow.
- Proof enhancements are isolated from the main connection: receipt photos are optimized before Drive upload; PDFs remain unchanged; proof metadata stays outside the yearly JSON payload.
- Proof export supports quarter/year combined PDF with a completeness index.
- Invoice numbering remains `YYYY-DDMMNNN` and allocates the lowest available sequence in the quarter so an unissued/deleted last number can be reused without a gap.
- OS invoice numbering is deferred until issue actions (send/mark sent/send to bookkeeping/final PDF) rather than merely opening a draft.
- OS cancellation markers allow Bookkeeping to move an imported cancelled OS invoice to Deleted on refresh.

Built from v4.1 specifically to avoid the incomplete-package regression in v4.2.
