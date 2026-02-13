---
created_at: 2026-02-13T19:52:48.718Z
updated_at: 2026-02-13T19:52:48.718Z
tags: []
source: mcp
---
Registry implementations cache loaded data so getStore() can be synchronous. Call load() once, then reuse getStore() without re-reading disk.