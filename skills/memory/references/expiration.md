# Expiration Policies

Use expiration dates to automatically manage temporary knowledge. This keeps stores clean and prevents stale information from polluting future sessions.

## When to Use Expiration

| Memory Type              | Suggested Expiration | Example                                                    |
| ------------------------ | -------------------- | ---------------------------------------------------------- |
| Session context          | 1-7 days             | Current task focus, temporary decisions, recent changes, notes |
| Sprint/iteration notes   | 2-4 weeks            | Sprint goals, in-progress work                             |
| Experimental approaches  | 1-2 weeks            | "Trying X approach for problem Y"                          |
| Time-sensitive decisions | Until deadline       | "Deploy freeze until March 15"                             |
| Never expires            | (no expiry)          | Architecture decisions, user preferences, coding standards, issue resolutions and runbooks for debugging |

## Expiration Patterns

### Convert temporary to permanent

If an investigation or experiment becomes a permanent finding:

```
cortex_update_memory(
  store: "my-project",
  path: "investigations/performance-issue",
  clear_expiry: true
)
```

### Review expired memories before pruning

```
cortex_list_memories(store: "my-project", include_expired: true)
# Check is_expired field in response
```

### Prune expired memories

```
cortex_prune_memories(store: "default")
cortex_prune_memories(store: "my-project")
```

## Session Cleanup Workflow

At the end of a conversation where you created context-specific memories, consider:

1. **Review what you created** - List memories in the project category
2. **Set expiration on temporary items** - Context, investigations, experiments
3. **Leave permanent items alone** - Decisions, standards, preferences

```
# Example: Mark session context to expire in 3 days
cortex_update_memory(
  store: "default",
  path: "projects/cortex/context/current-task",
  expires_at: "2026-02-01T00:00:00Z"
)

# Example: Keep decision permanent (no expiry needed if not set)
# Architecture decisions, coding standards, user preferences, issue resolutions, runbooks for debugging
# should NOT have expiration dates
```

## What Should Never Expire
You should never expire stable, long-term knowledge that forms the foundation of your understanding of the project and user. Examples:

- **User identity and preferences** (`human/profile/`, `human/preferences/`)
- **Architecture decisions** (`decisions/`, `architecture/`)
- **Coding standards** (`standards/`)
- **Issue resolutions** (`issues/`)
- **Persona configuration** (`persona/`)
- **Business Domain knowledge** (`domain/`)

