---
name: memory
description: Use to manage persistent memory entries using the Cortex MCP tools
compatibility: opencode
---

# Memory Skill

Use Cortex memory only through MCP tools.

## Non-Negotiable Rules

1. Never treat memory as files on disk. Do not use file tools or grep for memory data.
2. Always set `store` explicitly on memory/category operations.
3. Load memory before decisions: list → narrow category → fetch only relevant entries.
4. Write atomic memories (one fact/decision per memory), update instead of duplicating.
5. Save small temporary trace memories often while working (plan updates, findings, decisions-in-progress) so future sessions can resume quickly.
6. Set expiration for temporary context; leave durable knowledge without expiry.
7. Refuse or redact secrets/sensitive data before storing memory.

## Default Operating Loop

1. Discover stores: `cortex_list_stores()`
2. Explore relevant categories: `cortex_list_memories(store: "...", category: "...")`
3. Read only what is needed: `cortex_get_memory(...)`
4. Persist key deltas frequently as small entries: `cortex_add_memory(...)` or `cortex_update_memory(...)`
5. Add expiry to temporary trace entries and prune as needed

## Prompt-to-Workflow Routing Examples

- "Start this task and load relevant memory first" → `references/workflows/session-start.md`
- "We just ran cortex init for this repo; create initial memories" → `references/workflows/new-project-init.md`
- "Capture this architectural decision so we remember it" → `references/workflows/capture-knowledge.md`
- "From this conversation, save my preferences and project rules" → `references/workflows/synthesize-facts.md`
- "Clean up memory structure; categories are messy and duplicated" → `references/workflows/review-hygiene.md`
- "Wrap up: expire temporary notes and prune stale entries" → `references/workflows/session-end-cleanup.md`

## References

- Fundamentals (store choice, hierarchy, naming, loading, expiry, schema): `references/fundamentals.md`
- MCP operations cheat sheet: `references/operations.md`
- Workflow index: `references/workflows.md`
