---
"@yeseh/cortex-cli": minor
---

Add TTY-aware interactive prompts to `cortex init` and `cortex store init`. When running in a real terminal, users are asked to confirm or change the resolved path and store name before anything is written to disk. Non-TTY environments (CI, pipes, scripts) are completely unaffected.
