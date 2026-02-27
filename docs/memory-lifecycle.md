# Memory Lifecycle

This guide covers expiration, pruning, and the discipline of keeping memory stores clean over time.

## Why Expiration Matters

Memory stores accumulate over time. Without expiration, they fill with stale context that was relevant for one session but pollutes future ones — half-finished investigations, notes about a problem that was since resolved, task context from last month.

Expiration is not about forgetting. It is about signalling that a memory has a bounded useful life. Memories that are never revisited and eventually expire are automatically removed by pruning. Memories that prove durable can have their expiry cleared.

---

## Expiration Policy by Memory Type

| Memory Type                      | Expiry     | Examples                                                             |
| -------------------------------- | ---------- | -------------------------------------------------------------------- |
| Daily session context / standups | 1–7 days   | Current task focus, what you were working on                         |
| Active investigations            | 1–2 weeks  | "Trying approach X for problem Y"                                    |
| Sprint or iteration notes        | 2–4 weeks  | Sprint goals, in-progress feature notes                              |
| Time-sensitive decisions         | Until date | "API freeze until March 15"                                          |
| **Never expires**                | —          | Architecture decisions, coding standards, user preferences, runbooks |

When in doubt, set an expiry. Durable knowledge survives pruning because it gets revisited and refreshed. Stale context does not need to.

---

## Setting Expiration

Pass an ISO 8601 date string to `expires_at` when creating or updating a memory:

```
# When creating
cortex_add_memory(
  store: "my-project",
  path: "standup/2026-02-27",
  content: "Worked on memory lifecycle docs and skills directory.",
  expires_at: "2026-03-06T00:00:00Z"   # 7 days
)

# When updating an existing memory
cortex_update_memory(
  store: "my-project",
  path: "investigations/sqlite-index",
  expires_at: "2026-03-13T00:00:00Z"   # 2 weeks
)
```

---

## Clearing Expiration

If a temporary memory turns out to be durable — an investigation that became an architecture decision — clear the expiry:

```
cortex_update_memory(
  store: "my-project",
  path: "investigations/sqlite-index",
  expires_at: null    # removes expiration — memory is now permanent
)
```

Then consider moving it to a more appropriate category:

```
cortex_move_memory(
  store: "my-project",
  from_path: "investigations/sqlite-index",
  to_path: "decisions/use-sqlite-derived-index"
)
```

---

## Viewing Expired Memories

Before pruning, review what has expired to avoid accidentally losing something you still need:

```
cortex_list_memories(store: "default", include_expired: true)
cortex_list_memories(store: "my-project", include_expired: true)
```

The response includes an `is_expired` flag on each memory. Review expired items and either:

- **Delete them** by pruning (they're truly stale)
- **Update them** with a new expiry or `expires_at: null` if they're still relevant

---

## Pruning

Pruning permanently deletes all expired memories from a store. Run it periodically to keep stores clean.

```
cortex_prune_memories(store: "default")
cortex_prune_memories(store: "my-project")
```

A good habit is to prune at the end of a session after reviewing what you created.

From the CLI:

```bash
cortex memory prune --store my-project
```

---

## What Should Never Expire

Some knowledge forms the stable foundation of how an agent understands a project and user. Never set expiration on:

| Category             | Examples                                      |
| -------------------- | --------------------------------------------- |
| `human/profile/`     | User identity, background, goals              |
| `human/preferences/` | Coding style, communication preferences       |
| `persona/`           | Agent tone, expertise, behavior configuration |
| `standards/`         | Coding standards, conventions, style guides   |
| `decisions/`         | Architecture Decision Records                 |
| `runbooks/`          | Debugging procedures, operational playbooks   |

These memories are meant to persist indefinitely and accumulate over time into an increasingly useful context layer.

---

## Session Cleanup Checklist

At the end of a session where you created temporary context:

1. List what you created in project categories
2. Set expiry on standup notes, investigation notes, task context
3. Confirm decisions and standards have no expiry set
4. Prune expired memories from each store

```
# Example: end-of-session cleanup
cortex_list_memories(store: "my-project", category: "standup")
cortex_update_memory(store: "my-project", path: "standup/2026-02-27", expires_at: "2026-03-06T00:00:00Z")
cortex_prune_memories(store: "my-project")
cortex_prune_memories(store: "default")
```

---

## Reindexing

If the index for a store becomes inconsistent (unexpected missing memories, listing errors), rebuild it:

```
cortex_reindex_store(store: "my-project")
```

Or from the CLI:

```bash
cortex memory reindex --store my-project
```

Reindexing scans all memory files on disk and rebuilds the category index from scratch. It is safe to run at any time and does not modify memory content.
