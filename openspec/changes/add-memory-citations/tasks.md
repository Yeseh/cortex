## 1. Core — Add `citations` to `MemoryMetadata`

- [ ] 1.1 Add `citations: string[]` to `MemoryMetadata` type in `packages/core/src/memory/types.ts`
- [ ] 1.2 Add `citations?: string[]` to `CreateMemoryInput` in `packages/core/src/memory/operations.ts`
- [ ] 1.3 Add `citations?: string[]` to `UpdateMemoryInput` in `packages/core/src/memory/operations.ts`
- [ ] 1.4 Update `createMemory` to pass citations through to storage (default `[]`)
- [ ] 1.5 Update `updateMemory` to handle citations with overwrite semantics (omission preserves, `[]` clears)
- [ ] 1.6 Add tests for create with citations, update citations, preserve on unrelated update, clear with `[]`

## 2. Storage-FS — Frontmatter serialization

- [ ] 2.1 Add `citations` to `FrontmatterSchema` in `packages/storage-fs/src/memories.ts` (optional, defaults to `[]`)
- [ ] 2.2 Update `parseMemory` to deserialize `citations` from frontmatter (missing field → `[]`)
- [ ] 2.3 Update `serializeMemory` to serialize `citations` to frontmatter (omit key when empty array)
- [ ] 2.4 Add tests for round-trip with citations present, absent, and empty

## 3. Validation

- [ ] 3.1 Add citation validation: each element must be a non-empty string (reuse `nonEmptyStringSchema` pattern)
- [ ] 3.2 Add tests for validation (empty string rejected, valid strings accepted)

## 4. MCP tools — Add citations support

- [ ] 4.1 Add `citations: z.array(z.string()).optional()` to `addMemoryInputSchema` in `packages/server/src/memory/tools.ts`
- [ ] 4.2 Add `citations: z.array(z.string()).optional()` to `updateMemoryInputSchema`
- [ ] 4.3 Update `getMemoryHandler` to include `citations` in response metadata
- [ ] 4.4 Add tests for MCP tools with citations (add, get, update)

## 5. CLI — Add `--citation` flag

- [ ] 5.1 Add repeatable `--citation <value>` option to `add` command in `packages/cli/src/commands/memory/add/command.ts`
- [ ] 5.2 Add repeatable `--citation <value>` option to `update` command in `packages/cli/src/commands/memory/update/command.ts`
- [ ] 5.3 Pass citations through to core operations
- [ ] 5.4 Add tests for CLI commands with `--citation` flag

## 6. Verification

- [ ] 6.1 Run full test suite (`bun test packages`)
- [ ] 6.2 Run type check (`bunx tsc --build`)
- [ ] 6.3 Run linter (`bunx eslint packages/*/src/**/*.ts --fix`)
