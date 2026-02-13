---
created_at: 2026-02-11T20:20:45.452Z
updated_at: 2026-02-11T20:20:45.452Z
tags:
  - decision
  - performance
  - architecture
  - pragmatism
source: mcp
---
Default to simple algorithms first. Optimize only when there's concrete evidence of a performance problem.

Example: For `cortex_get_recent_memories`, walk all categories, collect entries, sort globally, slice top-n — rather than building early-termination or streaming strategies upfront.

Rationale: Future storage backends (e.g., database-backed) may eliminate the need for filesystem-level optimizations entirely. Premature optimization adds complexity for uncertain gain.