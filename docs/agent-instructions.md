# Agent Instructions for Cortex

This guide explains how to wire Cortex into your AI agent's instructions so it uses persistent memory effectively from the start.

## The Basics

Cortex exposes memory via MCP tools. For an agent to use it, two things must be true:

1. The MCP server is running and connected (see [README](../README.md))
2. The agent has instructions telling it _when_ and _what_ to save

Without explicit instructions, agents either over-save (slow, noisy) or ignore memory entirely. The instructions below give agents a clear, lightweight protocol.

---

## Minimal Agent Instruction Block

Copy this into your `AGENTS.md`, system prompt, or agent configuration file. Adjust the store name to match your project.

````markdown
## Memory

Use Cortex MCP tools to maintain persistent memory across sessions.

### Session start

At the start of every session, load context:

```
cortex_list_stores()                              # discover available stores
cortex_get_recent_memories(store: "default", limit: 5)
cortex_get_recent_memories(store: "<project>", limit: 10)
```

If a memory's path looks relevant to the current task, load it with `cortex_get_memory`.

### During work

Save new knowledge after completing meaningful work:

- Architecture decisions → `<project>` store, `decisions/` category
- Coding standards discovered → `<project>` store, `standards/` category
- Bugs found and fixed → `<project>` store, `runbooks/` category
- User preferences learned → `default` store, `human/preferences/` category

Keep memories concise (a few sentences). Prefer multiple focused memories over one large document.

### Session end

Set expiration on temporary context you created. Leave decisions and standards without expiry.

```
cortex_prune_memories(store: "default")
cortex_prune_memories(store: "<project>")
```
````

---

## OpenCode Configuration

In OpenCode, add the instruction block to your project's `AGENTS.md`. OpenCode passes this file to the model at session start.

For the Cortex MCP server to be available, add it to `.opencode/config.json`:

```json
{
    "mcpServers": {
        "cortex": {
            "command": "cortex-mcp"
        }
    }
}
```

Or with a custom config path:

```json
{
    "mcpServers": {
        "cortex": {
            "command": "cortex-mcp",
            "args": ["--config", "/path/to/cortex.yaml"]
        }
    }
}
```

The MCP server auto-initializes a default store on first run. No manual `cortex init` is required.

---

## Claude Desktop Configuration

Add Cortex to your `claude_desktop_config.json`:

```json
{
    "mcpServers": {
        "cortex": {
            "command": "cortex-mcp"
        }
    }
}
```

System prompt instructions for Claude Desktop should follow the same pattern as the minimal block above.

---

## What to Tell Agents to Save

### Always save (no expiry)

| What                           | Store     | Path pattern                      |
| ------------------------------ | --------- | --------------------------------- |
| Architecture decisions (ADRs)  | project   | `decisions/<verb>-<noun>`         |
| Coding standards               | project   | `standards/<topic>`               |
| Debugging runbooks             | project   | `runbooks/<component>`            |
| User coding preferences        | `default` | `human/preferences/coding`        |
| User communication preferences | `default` | `human/preferences/communication` |

### Save with expiry

| What                 | Store   | Path pattern             | Expiry  |
| -------------------- | ------- | ------------------------ | ------- |
| Current task context | project | `standup/<date>`         | 7 days  |
| Active investigation | project | `investigations/<topic>` | 2 weeks |
| Sprint notes         | project | `todo/<feature>`         | 4 weeks |

### Do not save

- Passwords, API keys, tokens, or any credentials
- Raw code snippets (save file paths and line numbers instead)
- Intermediate reasoning that won't be useful next session
- Anything that belongs in version-controlled documentation

---

## Loading Strategy

Agents should load memory progressively, not all at once:

1. **Enumerate stores** — `cortex_list_stores()` to know what's available
2. **Scan recent memories** — `cortex_get_recent_memories()` to catch up on last session
3. **Drill into relevant categories** — `cortex_list_memories(category: "decisions")` when working in that area
4. **Load specific memories** — `cortex_get_memory()` only when the content is needed

Avoid loading every memory in a store at the start of a session. Use `token_estimate` from list results to skip large memories unless directly relevant.

---

## Team and Shared Memory

When `.cortex/` is committed to version control, all team members and agents share the same project-local memory store. This makes it useful for:

- Onboarding: agents read existing standards and decisions automatically
- Consistency: agents write new decisions to the same place
- Review: humans can read and edit memory files directly in git

To initialize a shared store:

```bash
cortex store init       # creates .cortex/memory in the current git repo
git add .cortex
git commit -m "chore: initialize cortex memory store"
```
