# Renoweet Focus Hub v3.7

- Fixed Bookkeeping **Refresh Drive** so it authorizes correctly even when Bookkeeping is opened in a separate browser tab.
- Strengthened OS → Bookkeeping queue persistence: **Send to bookkeeping** now stores a durable queue marker on the project invoice as well as the OS bookkeeping queue row.
- Bookkeeping detects waiting invoices from either source, preventing an older/missed queue-row write from leaving the counter at 0.
- Re-read the OS project after form save so the queued invoice always uses the latest project/customer/invoice values.
- Bumped the service-worker cache to v3.7.
