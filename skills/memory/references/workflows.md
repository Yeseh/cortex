# Common Workflows

## Session Initialization

```
# 1. Check what categories exist in the default store
cortex_list_memories(store: "default")

# 2. Load user identity if present
cortex_list_memories(store: "default", category: "human")
cortex_get_memory(store: "default", path: "human/profile/identity")  # if exists

# 3. Load persona if configured
cortex_list_memories(store: "default", category: "persona")

# 4. Check for current project knowledge
cortex_list_memories(store: "default", category: "projects/[current-project]")

# 5. If project has its own store, check it too
cortex_list_stores()  # See if project store exists
cortex_list_memories(store: "my-project")  # Load project-specific memories
```

## Working with Project Stores

When a project has its own dedicated store (created via `cortex store init`):

```
# List available stores to discover project stores
cortex_list_stores()

# List memories in project store
cortex_list_memories(store: "my-project")

# Store architecture decision in project store
cortex_add_memory(
  store: "my-project",
  path: "decisions/use-event-sourcing",
  content: "# Event Sourcing Decision\n\n## Context\n...",
  tags: ["adr", "architecture"]
)

# Project stores don't need projects/ prefix - everything is project-scoped
cortex_add_memory(
  store: "my-project",
  path: "standards/api-design",  # Not projects/my-project/standards/api-design
  content: "..."
)
```

## Storing Project Knowledge

```
# Create category structure
cortex_create_category(store: "default", path: "projects/my-app/architecture")
cortex_set_category_description(
  store: "default",
  path: "projects/my-app",
  description: "React frontend with Node.js API"
)

# Store specific knowledge
cortex_add_memory(
  store: "default",
  path: "projects/my-app/architecture/api-patterns",
  content: "REST API follows resource-based routing. All endpoints return JSON.",
  tags: ["api", "patterns"]
)
```

## Recording User Preferences

```
cortex_add_memory(
  store: "default",
  path: "human/preferences/coding",
  content: "- Prefers functional style over OOP\n- Uses TypeScript strict mode\n- Avoids classes when functions suffice",
  tags: ["coding", "style"]
)
```

## Memory Migration

If memories are in the wrong location, use `cortex_move_memory`:

```
# Move misplaced memory
cortex_move_memory(
  store: "default",
  from_path: "global/human/profile",      # Wrong: 'global' prefix
  to_path: "human/profile/identity"       # Correct: proper hierarchy
)
```

## Session Cleanup

At the end of a session, set expiration on temporary context you created:

```
# Mark current task context to expire in 3 days
cortex_update_memory(
  store: "default",
  path: "projects/cortex/context/current-task",
  expires_at: "2026-02-01T00:00:00Z"
)

# Prune any already-expired memories
cortex_prune_memories(store: "default")
```

See [expiration.md](expiration.md) for detailed expiration policies.
