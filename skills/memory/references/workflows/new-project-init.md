# New Project Initialization (after cortex init)

**Use when:** a project store was just created and has little or no memory.

**Example trigger:** “`cortex` store exists but has no categories yet.”

```txt
# Confirm store exists
cortex_list_stores()

# Create foundational categories
cortex_create_category(store: "cortex", path: "standards")
cortex_create_category(store: "cortex", path: "decisions")
cortex_create_category(store: "cortex", path: "runbooks")
cortex_create_category(store: "cortex", path: "features")
cortex_create_category(store: "cortex", path: "todo")

# Add category descriptions for discovery
cortex_set_category_description(store: "cortex", path: "standards", description: "Coding/testing/review standards for this repo")
cortex_set_category_description(store: "cortex", path: "decisions", description: "Architecture and implementation decisions with rationale")
cortex_set_category_description(store: "cortex", path: "runbooks", description: "Debug and operational procedures")

# Seed initial durable memories (examples)
cortex_add_memory(store: "cortex", path: "standards/testing", content: "Run package tests before merging changes.", tags: ["testing", "quality"])
cortex_add_memory(store: "cortex", path: "standards/architecture", content: "Keep entrypoints thin; business logic belongs in core.", tags: ["architecture", "core"])
```
