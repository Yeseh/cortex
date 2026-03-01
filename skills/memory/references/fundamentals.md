# Memory Fundamentals

## Core Model
- **Store**: Top-level memory container (`default` or a project store)
- **Category**: Hierarchical path inside a store (for example, `standards/testing`)
- **Memory**: One atomic fact/decision at `category/.../slug`

## Rules That Always Apply
1. Always pass `store` explicitly on memory and category operations.
2. Path must not include the store name.
3. Prefer one concept per memory; update existing memory instead of duplicating.
4. Use category descriptions for discoverability.
5. Never store secrets (passwords, API keys, credentials, tokens).

## Store Selection
- Use `store: "default"` for:
  - `human/...` (identity/preferences)
  - `persona/...`
  - cross-project/general knowledge
- Use a project store (for example, `store: "cortex"`) for project architecture, decisions, standards, and runbooks.
- Fallback only when no project store exists: `store: "default"` + `projects/{project}/...`.

## Loading Strategy (Efficiency First)
Do not load all memories.

1. Discover stores: `cortex_list_stores()`
2. Inspect top-level categories: `cortex_list_memories(store: "...")`
3. Drill down into likely category paths: `cortex_list_memories(store: "...", category: "...")`
4. Read only selected memories: `cortex_get_memory(...)`

Use these signals to decide what to fetch:
- `path`: strong semantic match to current task
- `description`: category relevance summary
- `token_estimate`: skip large entries unless directly needed

## Expiration Policy
Set `expires_at` for temporary memory:
- session/context notes: 1-7 days
- investigations/experiments: 1-2 weeks
- sprint notes/todos: 2-4 weeks

Do not expire durable knowledge:
- `human/profile`, `human/preferences`
- architecture/decisions/standards/runbooks

Use `cortex_prune_memories(store: "...")` to clean expired entries.

## Human Identity Schema
When capturing user identity, use `human/profile/identity` with this format:

```markdown
- Full name: [User's complete name]
- Region: [NL/BE/DE/PL/CH/US/Other]
- Role: [Consultant/Sales/HR/Leadership/Other]
- Handle: [lowercase-identifier]
```
