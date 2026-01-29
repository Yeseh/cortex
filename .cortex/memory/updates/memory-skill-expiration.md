---
created_at: 2026-01-29T17:41:03.824Z
updated_at: 2026-01-29T17:41:03.824Z
tags:
  - skill
  - documentation
  - expiration
source: mcp
expires_at: 2026-02-05T18:40:47.000Z
---
# Memory Skill Updated with Expiration Policies

**Update**: Added comprehensive expiration policy documentation to the memory skill.

**New file**: `references/expiration.md` covering:
- When to use expiration (table with suggested durations)
- Expiration patterns (short-lived, sprint-scoped, event-driven)
- Managing expiration (extend, clear, review, prune)
- Session cleanup workflow
- What should never expire

**Updated files**:
- `practices.md` - Added expiration best practices, link to expiration.md
- `workflows.md` - Added "Session Cleanup" workflow section
- `SKILL.md` - Added expiration.md to references list

**Location**: `C:\Users\micro\.config\opencode\skills\memory\references\`