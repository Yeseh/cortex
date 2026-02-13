# Change: Add Citations to Memories

## Why

Memories currently have no way to reference the source material they describe. When an agent loads a memory about an architectural pattern or coding standard, it cannot verify whether the memory is still accurate against the actual codebase. Citations solve this by attaching verifiable references (file paths, URLs) to memories, enabling agents to perform just-in-time verification before trusting stored knowledge.

## What Changes

- **Add `citations: string[]` to `MemoryMetadata`**: Optional field defaulting to `[]` for backward compatibility
- **Update frontmatter format**: Add `citations` array to YAML frontmatter (snake_case on disk)
- **Update memory serialization**: Parse and serialize citations in frontmatter
- **Update `createMemory` and `updateMemory`**: Accept optional `citations` parameter
- **Update `get_memory` MCP response**: Include citations in returned metadata
- **Update `add_memory` and `update_memory` MCP tools**: Accept `citations` input parameter
- **Update CLI `add` and `update` commands**: Add repeatable `--citation` flag

## Impact

- Affected specs: `memory-core`, `storage-filesystem`, `mcp-memory-tools`, `cli-memory`
- Affected code:
    - `packages/core/src/memory/types.ts` — `MemoryMetadata` type
    - `packages/core/src/memory/operations.ts` — `CreateMemoryInput`, `UpdateMemoryInput`
    - `packages/storage-fs/src/memories.ts` — `FrontmatterSchema`, `parseMemory`, `serializeMemory`
    - `packages/server/src/memory/tools.ts` — add/update input schemas, get response
    - `packages/cli/src/commands/memory/add/command.ts` — `--citation` flag
    - `packages/cli/src/commands/memory/update/command.ts` — `--citation` flag
