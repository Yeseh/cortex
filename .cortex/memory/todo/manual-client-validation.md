---
created_at: 2026-02-18T10:00:00.000Z
updated_at: 2026-02-18T10:00:00.000Z
tags:
  - todo
  - api-review
  - client-hierarchy
  - validation
---
# Manual Client API Validation

Walk through the fluent client implementations and try to implement some handlers to validate the API ergonomics.

## Goals
- Verify the client hierarchy works well in practice: `Cortex → StoreClient → CategoryClient → MemoryClient`
- Test lazy validation patterns feel natural
- Identify any rough edges or missing convenience methods
- Validate error handling patterns are consistent

## Tasks

### 1. Implement a sample MCP handler using clients
- [ ] Pick an existing MCP tool handler (e.g., `cortex_add_memory`)
- [ ] Refactor it to use the fluent client API instead of raw adapter
- [ ] Compare ergonomics: is the code cleaner? More verbose?

### 2. Implement a sample CLI handler using clients
- [ ] Pick an existing CLI command handler (e.g., `memory add`)
- [ ] Refactor it to use the fluent client API
- [ ] Note any friction points

### 3. Test navigation patterns
- [ ] Try chaining: `cortex.getStore('x').rootCategory().getCategory('a/b').getMemory('slug')`
- [ ] Test parent navigation: `category.parent()`
- [ ] Test error propagation through the chain

### 4. Document findings
- [ ] Note any missing methods that would improve ergonomics
- [ ] Note any inconsistencies in the API surface
- [ ] Propose improvements if needed

## Context
- PR #41 adds StoreClient with lazy validation
- CategoryClient and MemoryClient already exist
- Current handlers use `getAdapter()` escape hatch - goal is to eventually remove this
