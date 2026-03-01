---
'@yeseh/cortex-cli': patch
---

Fix duplicate CLI error text for command failures.

When a command throws an error handled by `runProgram`, stderr now prints a single clear message instead of repeating the same text in both the main message and `error="..."` metadata.
