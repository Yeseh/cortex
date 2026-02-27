---
name: memory-review
compatibility: opencode
description: Use when reviewing memory quality, redundancy and organization. 
---

# Purpose

Use the `memory` skill to review memory stores incrementally and avoid full traversal by default. Do not add new metadata fields inside memories. Store review metadata in the `admin` category.

# Walkthrough
Walk through the following steps:

- Determine scope. Action: read per-store review state from `admin` (for example, `admin/review_state/<store>`) before acting, and only review memories updated since that timestamp. If no review state exists, create it using the template and scan only the highest-risk categories (large or recently active).
- Identify redundant or vague memories. Action: update, consolidate or delete as needed; mark reviewed items to skip next run.
- Identify duplicated categories with similar names (for example: test, tests, testing). Action: consolidate into a single category with a clear name.
- Identify categories with overlapping information. Action: consolidate or split as needed.
- Identify categories with no clear structure or organization (flat categories with many memories). Action: reorganize into a more logical, fine-grained hierarchy.
- Identify categories with missing descriptions. Action: add clear and concise descriptions.
- Identify memories that are too large, complex, or include excessive code snippets (longer than ~50 lines or 250 tokens). Action: break them into smaller, atomic memories and use references to code files/functions instead of including code snippets directly in memory entries.
- Prune expired memories. 
- After cleaning up, reindex only the stores that changed. Action: use `cortex_reindex_store` for each updated store.
- Update review state. Action: write per-store review metadata under `admin/review_state/<store>` (for example, last reviewed timestamp, categories reviewed, and any tags like `needs_merge` or `needs_split` for next pass).

# Rules
- Dispatch subagents to review multiple root categories in parallel, against the current state of the repository. Action: spawn a subagent for each root category to review in parallel, and aggregate findings before making edits. 
- Dispatch subagents to implement findings per category in parallel. Action: spawn a subagent for each category that needs edits to implement changes in parallel, and aggregate results before reindexing.
- Do not include the 'admin' category in the review process. Action: skip any categories under `admin` when traversing memories for review.

# Review findings
- Very large categories (for example, more than 20 memories) with no clear structure or organization should be reorganized into a more logical, fine-grained hierarchy.
- Memories that are too large, complex, or include excessive code snippets (longer than ~50 lines or 250 tokens) should be broken into smaller, atomic memories and use references to code files/functions instead of including code snippets directly in memory entries.
- Redundant or vague memories should be updated, consolidated or deleted as needed.
- Duplicated categories with similar names (for example: test, tests, testing) should be consolidated into a single category with a clear name.
- Categories with overlapping information should be consolidated or split as needed.
- Categories with missing descriptions should have clear and concise descriptions.
- Large runbooks, or issue descriptions should be suggested to be stored into another format like markdown files in the codebase, and referenced from memory, instead of being stored directly in memory.

Review state template (store in `admin/review_state/<store>`):
```
title: Review state for <store>
last_reviewed_at: YYYY-MM-DD
reviewed_categories:
- <category/path>
notes:
- <short note>
flags:
- needs_merge
- needs_split
```

Use your `question` tool to ask for clarification if needed.
