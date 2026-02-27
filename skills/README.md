# Skills

Pre-built agent skills for working with Cortex. These are designed for [OpenCode](https://opencode.ai) but the concepts apply to any AI coding agent with MCP support.

## Installation

Copy the skills you want into your OpenCode global skills directory:

```bash
# Copy all three skills at once
cp -r skills/memory ~/.config/opencode/skills/
cp -r skills/memory-review ~/.config/opencode/skills/
cp -r skills/memory-synthesize ~/.config/opencode/skills/
```

OpenCode picks up skills automatically from `~/.config/opencode/skills/`. Restart your session after installing.

---

## Available Skills

### `memory/`

Core memory management skill. Teaches agents when to save, what to save, how to organize memories, and how to load context efficiently without blowing the context window.

Load this skill at the start of any session involving memory operations.

**Files:**

- `SKILL.md` — agent-readable instructions
- `README.md` — human documentation
- `references/` — detailed guidance on concepts, hierarchy, loading strategy, expiration, workflows, and best practices

### `memory-review/`

Memory quality review skill. Walks agents through an incremental audit of a store: removing stale or redundant memories, consolidating duplicate categories, adding missing descriptions, and reindexing after changes.

**Files:**

- `SKILL.md` — agent-readable instructions

### `memory-synthesize/`

Memory synthesis skill. Extracts key facts from the current conversation and persists them to the right store and category. Prompts the user before writing anything.

**Files:**

- `SKILL.md` — agent-readable instructions

---

## Usage

For OpenCode, reference skills in your `AGENTS.md` or system prompt. Skills are loaded on demand:

```markdown
## Memory

Use the `memory` skill to manage persistent memory using the Cortex MCP tools.
At the end of each session, use the `memory-synthesize` skill to extract and
save key facts from the conversation.
```

Or invoke them directly in a conversation:

```
/memory-synthesize
/memory-review
```
