---
created_at: 2026-02-13T19:53:29.621Z
updated_at: 2026-02-13T19:53:29.621Z
tags: []
source: mcp
---
Always use node:path and node:os helpers (join, resolve, isAbsolute, homedir, tmpdir). Never hardcode slashes/backslashes or build paths via string concatenation.