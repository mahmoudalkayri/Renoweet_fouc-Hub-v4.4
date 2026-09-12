# Renoweet Focus Hub v2.8

Startup cache correction for Renoweet OS.

After a browser refresh, OS now prefers the last checksum-verified Google Drive yearly cache over a stale legacy XLSX/local cache, unless there are genuine unsynced local edits that must be preserved. This means the last verified Drive project set is shown immediately as an offline cache while Google OAuth is disconnected. Reconnecting Drive still verifies and replaces it with the current live yearly JSON.

The OS Drive adapter filename was versioned to v2.8 to avoid stale browser/service-worker caching.
