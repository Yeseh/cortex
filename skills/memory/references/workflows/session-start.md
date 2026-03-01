# Session Start: Load Only What Matters

**Use when:** starting work, switching tasks, or before significant decisions.

**Example trigger:** “I’m about to refactor indexing logic; check prior decisions first.”

```txt
cortex_list_stores()

# Global user/persona context
cortex_list_memories(store: "default", category: "human")
cortex_list_memories(store: "default", category: "persona")

# Project context (prefer project store when it exists)
cortex_list_memories(store: "cortex")

# Load only relevant entries discovered above
cortex_get_memory(store: "cortex", path: "decisions/index-strategy")
```
