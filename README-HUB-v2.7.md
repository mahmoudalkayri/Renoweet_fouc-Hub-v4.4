# Renoweet Focus Hub v2.7

Drive reliability patch:
- The OS only shows the “Renoweet-YYYY.json is new” import prompt when the canonical Drive database is truly revision 0 with OS revision 0 and no OS records.
- Saving a project from the project dialog now waits for a verified Google Drive save when Drive is connected, preventing a draft/autosave timing race from marking an empty revision as saved.
- Core filename/cache version bumped to v2.7 to avoid stale browser/service-worker code.
