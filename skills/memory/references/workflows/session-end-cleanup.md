# Session End Cleanup

**Use when:** temporary context/investigation memories were created during work.

**Example trigger:** short-lived debugging notes were added under `todo/` or `investigations/`.

```txt
# Add expiry to temporary entries
cortex_update_memory(
  store: "cortex",
  path: "investigations/index-flake",
  expires_at: "2026-03-08T00:00:00Z"
)

# Prune expired entries
cortex_prune_memories(store: "cortex")
```
