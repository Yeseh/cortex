# Change: Add memory core model

## Why
The Cortex memory system needs a consistent, filesystem-based data model to represent memories and categories before other features can build on it.

## What Changes
- Define the memory hierarchy (two levels of nesting) and slug-based identity rules.
- Specify the memory file format with YAML frontmatter metadata.
- Define category rules and validation behavior.

## Impact
- Affected specs: memory-core
- Affected code: src/memory, src/core/types.ts, src/core/slug.ts
