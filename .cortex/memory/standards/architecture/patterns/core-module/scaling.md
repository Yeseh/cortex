---
created_at: 2026-02-13T19:52:48.712Z
updated_at: 2026-02-13T19:52:48.712Z
tags: []
source: mcp
---
When a core module grows large, split operations into per-operation files (create.ts, delete.ts, set-description.ts) with matching spec files and re-export them from the module index. Keep each file focused and under a few hundred lines.