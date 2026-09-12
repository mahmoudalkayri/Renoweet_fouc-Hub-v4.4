# Renoweet Focus Hub v3.6

- Fixed OS Drive save race: manual Save and Send to bookkeeping now wait for any in-flight autosave instead of falsely reporting that Drive did not confirm the save.
- A fresh verified save is then performed so the latest invoice/project state is included.
- Service-worker cache reference bumped to the v3.6 OS adapter.
