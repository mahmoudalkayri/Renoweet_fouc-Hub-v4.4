# Renoweet Focus Hub v2.6

Drive reconnect fix:
- scans every accessible `Renoweet-YYYY.json` candidate, not only the current Active folder
- validates checksum/schema before accepting a candidate
- chooses the database with the highest revision (then newest modified time)
- remembers the winning Drive file ID for later reconnects
- new core filename and service-worker cache version prevent stale v2.5 code from being served

This specifically addresses the repeated “Renoweet-2026.json is new” prompt when a valid revision already exists in Drive.
