# Renoweet Focus Hub v2.5

Drive reconnection hotfix.

- Remembers and reuses the exact Google Drive folder IDs and yearly JSON file ID before falling back to Drive search.
- Prevents a reconnect from creating a duplicate `Renoweet Data` tree when the existing app-created file is still accessible.
- Stores active JSON IDs per year.
- Remembers the manifest file ID.
- Uses a new core filename (`renoweet-drive-core-v2.5.js`) to avoid stale browser/service-worker caching.

Upload all files to the GitHub Pages repository root, replacing the previous package.
