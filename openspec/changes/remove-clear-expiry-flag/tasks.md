## 1. Core Layer

- [x] 1.1 Remove `clearExpiry` field from `UpdateMemoryInput` interface
- [x] 1.2 Change `expiresAt` type from `Date | undefined` to `Date | null | undefined`
- [x] 1.3 Update `updateMemory()` merge logic to use `null` check instead of `clearExpiry`
- [x] 1.4 Update `hasUpdates` check to detect `expiresAt === null`
- [x] 1.5 Update JSDoc on `UpdateMemoryInput` and `updateMemory()`
- [x] 1.6 Update core test: change `clearExpiry: true` to `expiresAt: null`

## 2. MCP Server Layer

- [x] 2.1 Remove `clear_expiry` from `updateMemoryInputSchema` Zod schema
- [x] 2.2 Make `expires_at` nullable in Zod schema (`.nullable()`)
- [x] 2.3 Remove `clear_expiry` from `UpdateMemoryInput` interface
- [x] 2.4 Update `updateMemoryHandler` validation and mapping logic
- [x] 2.5 Update error message string to remove `clear_expiry` reference
- [x] 2.6 Update server test: change `clear_expiry: true` to `expires_at: null`

## 3. CLI Layer

- [x] 3.1 Remove `clearExpiry` from `UpdateCommandOptions` interface
- [x] 3.2 Remove `-E, --clear-expiry` Commander option
- [x] 3.3 Add `--no-expires-at` negation flag via Commander
- [x] 3.4 Remove mutual-exclusion check (`expiresAt && clearExpiry`)
- [x] 3.5 Update expiry resolution logic for 3-state `expiresAt` (string | false | undefined)
- [x] 3.6 Update JSDoc examples to use `--no-expires-at`
- [x] 3.7 Update CLI integration test: `--clear-expiry` → `--no-expires-at`
- [x] 3.8 Remove mutual-exclusion test (no longer applicable)

## 4. Supporting Files

- [x] 4.1 Update acceptance test script (`scripts/acceptance-test.ps1`)
- [x] 4.2 Update live OpenSpec spec (`openspec/specs/mcp-memory-tools/spec.md`)

## 5. Validation

- [x] 5.1 Run full test suite (`bun test packages`)
- [x] 5.2 Run typecheck (`bunx tsc --build`)
