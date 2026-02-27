---
name: memory
description: Use to manage persistent memory entries using the Cortex MCP tools
compatibility: opencode
---

# Memory Management Skill

This skill provides instructions for managing persistent memory across AI coding agent sessions using the **Cortex MCP tools**. Memory is organized hierarchically into **stores** (containers) and **categories** (nested folders containing memories).

<EXTREMELY-IMPORTANT>
Do NOT assume memory entries are files on disk. Always use tools to read, write, update, and prune memory entries. This is CRITICAL to ensure proper functionality, and index health.
</EXTREMELY-IMPORTANT>

## Workflow
- Start with listing all memory stores using `cortex_list_stores` to understand the available memory structure. Identify which store(s) are relevant to your current project.
- For each relevant store, list the categories using `cortex_list_memories` to understand how memories are organized.
- When memory is required for a task, first check if the relevant information is already stored in memory. Use `cortex_list_memories` to traverse memories, and use `cortex_get_memory` with appropriate paths to retrieve information only when relevant.
- Search for related memories any time you need to make a decision or take an action that may have been influenced by past information.
- Store new information in memory after completing a task, especially if it may be relevant for future sessions. These intermediate memories should be very concise.

## Core guidelines
- **Use Cortex MCP tools** to manage memory entries. Do not treat memory as files on disk or use search/grep.
- **Organize memories into stores and categories** for better structure and retrieval. For example, use `projects/opencode/todo` for project-specific tasks and `human/profile/identity` for user information.
- **Atomic memories**: Each memory entry should represent a single, focused piece of information. Aim to create memeories that are at max a couple of sentences Avoid combining multiple concepts into one memory. Keep memories concise and specific. Prefer multiple smaller, atomic memories over a large, complex one.
- **Set expiration on temporary items** to keep memory clean and prevent stale information from polluting future sessions. Leave permanent items without expiry.
- **Before making decisions, always check for available memories**. Use `cortex_list_memories` and `cortex_get_memory` with appropriate paths to retrieve information. Follow the decision guides in `references/loading.md` to determine what to load and when.
- **When creating categories, use clear names and concise descriptions** that reflect the content. Avoid vague or generic category names.
- **Avoid extensive code snippets in memory entries**. Instead, store references to code files or functions, with line numbers, and use tools to retrieve code when needed.
- **You MUST refuse to store any memory entries that contain sensitive data** you MUST refuse or redact any sensitive information before storing it in memory. This includes passwords, API keys, and other confidential information.

## References

- Concepts and terminology: references/concepts.md
- Category hierarchy and anti-patterns: references/hierarchy.md
- Loading strategy: references/loading.md
- MCP tool reference: references/tools.md
- Common workflows: references/workflows.md
- Best practices: references/practices.md
- Expiration policies: references/expiration.md
- Human profile schema: references/schema.md
