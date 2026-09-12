# Renoweet Focus Hub v3.5

- Fixed OS **Send to bookkeeping**: the wrapper now uses the public Drive adapter state and performs a verified Drive save after queuing the invoice.
- Fixed Bookkeeping OS queue counter/import button refresh logic.
- Fixed the PWA service worker app-shell list: v3.4 referenced a non-existent `renoweet-drive-core-v3.2.js`, which could prevent the new service worker from installing and leave stale code active.
- Bumped the cache to `renoweet-focus-hub-v3-5` so GitHub Pages clients receive the corrected files.
