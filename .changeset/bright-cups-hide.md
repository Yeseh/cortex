---
'@yeseh/cortex-cli': patch
---

Restore human-readable CLI log output by default.

CLI logs now emit readable stderr lines (`INFO: ...`, `WARN: ...`, `ERROR: ...`) instead of structured JSON by default, while keeping `DEBUG=cortex` gated debug logging and error context output.
