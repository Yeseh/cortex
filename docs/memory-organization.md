# Memory Organization

This guide covers how to structure your memories effectively — choosing the right store, naming categories, and writing memories that are useful across sessions.

## Core Concepts

### Stores

A **store** is a top-level container for memories. Think of it as a database. Each store has its own category hierarchy and is stored at a specific path on disk.

Two kinds of store are common:

| Kind          | Name          | Path                          | Purpose                                                  |
| ------------- | ------------- | ----------------------------- | -------------------------------------------------------- |
| Global        | `default`     | `~/.config/cortex/memory`     | User identity, preferences, cross-project knowledge      |
| Project-local | _(repo name)_ | `.cortex/memory` in repo root | Standards, decisions, maps, todos for a specific project |

Cortex resolves which store to use automatically:

1. Explicit `--store` flag / `store` parameter
2. Project-local store (`.cortex/memory` in the current directory)
3. Global default store

### Categories

A **category** is a path within a store that groups related memories. Categories nest freely:

```
standards/
standards/architecture/
standards/architecture/patterns
```

Categories are created automatically when you add memories, or explicitly via `cortex_create_category`. You can attach a description to any category to help agents understand what belongs there.

### Memories

A **memory** is a single document stored at a `category/slug` path. The slug is the last segment of the path. For example, the memory at `standards/api-design` lives in the `standards` category with the slug `api-design`.

Memories have:

- **Content**: freeform markdown text
- **Tags**: optional list of strings for filtering
- **Source**: who created the memory (`user`, `agent`, `mcp`, etc.)
- **Expiration**: optional ISO 8601 date after which the memory is considered stale

---

## Choosing a Store

**Use the project store** for knowledge that belongs to the codebase:

- Architecture decisions and ADRs
- Coding standards and conventions
- Codebase maps (file structure, module overviews)
- Ongoing todos and feature plans
- Debugging runbooks for this project

**Use the default store** for knowledge that is personal or cross-project:

- Your identity and preferences
- Agent persona configuration
- Quick notes about a project that don't belong in the repo
- Cross-project tooling knowledge

Rule of thumb: if the knowledge would belong in the repo's documentation, put it in the project store. If it's personal context about working on the project, use the default store.

---

## Recommended Category Structure

### Default Store

```
default/
├── human/
│   ├── profile/          # Who you are
│   └── preferences/      # How you work (coding style, communication)
└── persona/              # Agent behavior and tone
```

### Project Store

```
{project}/
├── standards/            # Coding standards, conventions
├── decisions/            # Architecture Decision Records
├── map/                  # Codebase maps, package overviews
├── features/             # Planned or in-progress features
├── todo/                 # Outstanding work items
├── runbooks/             # Debugging and operational procedures
├── investigations/       # Temporary research (set expiration)
└── standup/              # Daily summaries (7-day expiry)
```

---

## Writing Good Memories

### One concept per memory

Keep memories small and focused. Prefer multiple specific memories over one large document.

```
# Good: specific and actionable
path: standards/result-types
content: >
  All fallible operations return Result<T, E>. Never throw from business logic.
  Use ok(value) and err(error) from @yeseh/cortex-core.

# Bad: too broad
path: standards/everything
content: >
  Use Result types. Also follow the hex arch. Also tests go next to source. Also...
```

### Actionable content

Write memories as if briefing someone who needs to act on them. Prefer concrete statements over vague summaries.

```
# Good
content: >
  Memory files are validated in two separate pipelines: validation (pure checks)
  and transformation (input mutation). Keep them separate — do not mix in the
  same function.

# Bad
content: >
  We talked about validation and decided to separate things.
```

### Use tags for cross-cutting concerns

Tags help when listing memories across a category. Use them consistently:

```
tags: [architecture, breaking-change]
tags: [bug, regression, auth]
tags: [decision, api]
```

### Avoid storing code snippets

Store a file path and line number instead. Code changes; the reference stays accurate longer.

```
# Good
content: >
  The main entry point for store resolution is Cortex.getStore() in
  packages/core/src/cortex/index.ts:42. It returns a CortexClientResult.

# Bad
content: |
  function getStore(name: string) {
    const entry = this.registry[name];
    ...
  }
```

---

## Paths and Naming

- Use **kebab-case** slugs: `api-design`, `use-postgres`, `error-handling`
- Use **noun phrases** for stable knowledge: `result-type-conventions`, `test-isolation-rules`
- Use **verb-led slugs** for decisions: `use-bun-instead-of-node`, `remove-registry-abstraction`
- **Never include the store name** in the path. The `store` parameter is separate.

```
# Correct
cortex_add_memory(store: "cortex", path: "standards/result-types", ...)

# Wrong — store name in path
cortex_add_memory(store: "cortex", path: "cortex/standards/result-types", ...)
```

---

## Initializing a Project Store

Run `cortex store init` inside a git repository. Cortex will detect the repo name and create a project-local store at `.cortex/memory`:

```bash
cd ~/projects/my-app
cortex store init
# Creates .cortex/memory and registers "my-app" in global config
```

You can then commit `.cortex/` to version control so the whole team (and all agents) share the same memory.
