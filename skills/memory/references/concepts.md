# Key Concepts

## Store vs Category vs Memory

- **Store**: A top-level container (default: `default`). Think of it as a database. Most agents use the default store.
- **Category**: A path within a store that organizes related memories. Categories can be nested (e.g., `projects/cortex/architecture`).
- **Memory**: A single piece of knowledge stored as a markdown file with metadata.

**Critical**: The store name is NOT part of the category path. When using tools:

- Store parameter: `"default"` (REQUIRED on all memory/category operations)
- Path parameter: `human/profile/identity` (NOT `default/human/profile/identity`)

**Always specify the store explicitly** - this prevents ambiguity about which store you're reading from or writing to.

## Project Stores

A **project store** is a dedicated store for a specific project, separate from the default store. Use project stores when:

- The project has significant domain-specific knowledge (architecture, decisions, patterns)
- You want to keep project memories isolated from global/personal memories
- Multiple agents work on the same project and need shared context

### Creating a Project Store

Run `cortex store init` in a git repository to automatically:

1. Detect the repository name and use it as the store name
2. Create the store directory at `.cortex/` in the repo root
3. Register the store in the global registry (`~/.config/cortex/stores.yaml`)
4. Create a project entry in the default store at `projects/{name}`

```bash
# In a git repo - auto-detects name
cd ~/projects/my-app
cortex store init

# With explicit name (useful outside git repos)
cortex store init --name my-custom-store
```

### Using Project Stores

When working in a project with its own store, specify the store parameter:

```
# Store in project store (isolated to this project)
cortex_add_memory(
  store: "my-app",
  path: "architecture/api-patterns",
  content: "..."
)

# Store in default store (shared across projects)
cortex_add_memory(
  store: "default",
  path: "human/quick-notes",
  content: "..."
)
```

### When to Use Which

| Knowledge Type            | Store         | Path Example               |
| ------------------------- | ------------- | -------------------------- |
| Deep project architecture | Project store | `architecture/patterns`    |
| ADRs and decisions        | Project store | `decisions/use-postgres`   |
| Quick project notes       | Default store | `projects/my-app/notes`    |
| User preferences          | Default store | `human/preferences` |
| Cross-project knowledge   | Default store | `global/tools/docker`      |
