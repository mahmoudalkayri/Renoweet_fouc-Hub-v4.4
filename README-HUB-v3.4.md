# Renoweet Focus Hub v3.4

Invoice PDF print fix.

- OS invoice customer/project text now renders in a strong dark color in generated PDFs.
- Bookkeeping invoice PDF clone now receives the same A4 invoice CSS as the on-screen preview, fixing oversized logo/faint text/broken layout.
- New Bookkeeping-created invoice numbers now use the same `INV-YYYY-###` format as OS. Existing invoice numbers are preserved.
- Browser-added filename suffixes such as `(1)` can still appear when downloading the same filename more than once; this is controlled by the browser.
