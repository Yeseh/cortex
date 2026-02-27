---
name: memory-synthesize
description: Use to extract key facts about the user, agent persona, current project, or operating domain from the current context for managing memory
compatibility: opencode
---

# Memory Synthesis Skill

Extract and persist key facts from the current conversation into the appropriate memory categories.

## Prerequisites

Load the `memory` skill before executing this skill to understand the memory tools and hierarchy.

## Extraction Categories

### 1. Human (store: "default", path: "human/...")

User identity, preferences, and habits.

**Examples:**

- "I'm a senior engineer" → `human/profile/identity`
- "I prefer functional style" → `human/preferences/coding`
- "Don't explain basic concepts" → `human/preferences/communication`

### 2. Persona (store: "default", path: "persona/...")

Agent behavior configuration and personality.

**Examples:**

- "Be concise" → `persona/communication`
- "Focus on TypeScript" → `persona/expertise`
- "Always run tests before committing" → `persona/workflow`

### 3. Project (store: "{project-store}" or "default")

Project-specific knowledge, decisions, and context.

**Store selection:**

1. Check project stores with `cortex_list_stores()`.
2. If a store exists for the current project, use that store with paths like `architecture/...`, `decisions/...`, `standards/...`.
3. If no project store exists, use `store: "default"` with `projects/{project-name}/...` paths for lightweight notes.

**Examples (project store exists):**

- "This project uses event sourcing" → store: "cortex", path: `architecture/patterns`
- "We decided to use Zod for validation" → store: "cortex", path: `decisions/validation`
- "Tests must pass before merging" → store: "cortex", path: `standards/testing`

**Examples (no project store):**

- "This project uses event sourcing" → store: "default", path: `projects/cortex/architecture/patterns`
- "We decided to use Zod for validation" → store: "default", path: `projects/cortex/decisions/validation`
- "Tests must pass before merging" → store: "default", path: `projects/cortex/standards/testing`

## Execution Steps

1. **Extract facts** from the conversation into the categories above
2. **Determine stores** to use:
  ```
  cortex_list_stores()
  ```
3. **Check existing memories** for each fact (always specify store explicitly):
  ```
  cortex_list_memories(store: "default", category: "{category}")
  cortex_get_memory(store: "default", path: "{path}")  # if might exist
  ```
4. **Prompt user** using the question tool to confirm which facts to persist
5. **Persist confirmed facts** using appropriate tool:
  ```
  cortex_add_memory(
    store: "{resolved-store}",
    path: "{category}/{subcategory}/{slug}",
    content: "{extracted fact}",
    tags: ["{relevant}", "{tags}"]
  )
  ```
6. **Set expiration** for temporary facts (context, investigations, recent changes, issues that might get fixed soon)

## Rules

- MUST specify `store` explicitly on every memory and category operation
- MUST use `store: "default"` only for human, persona, and cross-project knowledge
- MUST prefer a project store for project facts when it exists (fallback to `store: "default"` with `projects/{name}/...` only if no project store exists)
- MUST check if memory already exists before creating
- MUST prompt user before persisting any new facts
- SHOULD update existing memories rather than creating duplicates
- SHOULD set expiration on temporary/context facts
- SHOULD NOT persist trivial or obvious facts
- SHOULD avoid placing project architecture/decisions in `store: "default"` when a project store exists

## Question Format

When prompting the user, group facts by category:

```
I extracted the following facts from our conversation:

**Human** (user preferences):
- [ ] Prefers functional programming style
- [ ] Senior engineer, skip basic explanations

**Project** (store: cortex):
- [ ] Store parameter is now required on all MCP tools
- [ ] Default store renamed from 'global' to 'default'

**Domain**:
- (none extracted)

Which facts should I persist to memory?
```

## Examples

### Input conversation snippet:

> "I'm an experienced TypeScript developer. This project uses Bun for testing. Don't over-explain things."

### Extracted memories:

| Fact                             | Category | Store        | Path                            | Expiration |
| -------------------------------- | -------- | ------------ | ------------------------------- | ---------- |
| Experienced TypeScript developer | human    | `default`    | `human/profile/identity`        | never      |
| Skip over-explanations           | persona  | `default`    | `persona/communication`         | never      |
| Project uses Bun for testing     | project  | `{project}`  | `standards/testing`             | never      |
