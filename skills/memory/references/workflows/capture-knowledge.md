# Capture New Knowledge During Work

**Use when:** a stable fact, decision, rule, or runbook step emerges.

**Example trigger:** “We confirmed an error is caused by stale index cache.”

```txt
# Check existing memory first
cortex_list_memories(store: "cortex", category: "decisions")
cortex_get_memory(store: "cortex", path: "decisions/index-cache-policy")

# Add or update (avoid duplicates)
cortex_add_memory(
  store: "cortex",
  path: "decisions/index-cache-policy",
  content: "Index cache must be refreshed after category merges.",
  tags: ["index", "cache"]
)
```
