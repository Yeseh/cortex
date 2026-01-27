# Tasks

## 1. Add dependencies

- [ ] 1.1 Add `@toon-format/toon` package to dependencies

## 2. Create core serialization module

- [ ] 2.1 Create `src/core/serialize.ts` with generic `serialize(obj, format)` function
- [ ] 2.2 Implement JSON serialization using `JSON.stringify`
- [ ] 2.3 Implement YAML serialization using the `yaml` library
- [ ] 2.4 Implement TOON serialization using `@toon-format/toon` package
- [ ] 2.5 Export `OutputFormat` type and `serialize` function from core index

## 3. Refactor CLI output module

- [ ] 3.1 Remove all type-specific serialization functions from `src/cli/output.ts`
- [ ] 3.2 Remove validation helpers (validation should happen at object construction)
- [ ] 3.3 Update CLI output to use core `serialize` function
- [ ] 3.4 Keep only CLI-specific concerns (if any) in output.ts or remove file entirely

## 4. Update CLI commands

- [ ] 4.1 Update memory commands to use core serialization
- [ ] 4.2 Update store commands to use core serialization
- [ ] 4.3 Update category commands to use core serialization

## 5. Cleanup

- [ ] 5.1 Delete `src/cli/toon.ts` (replaced by `@toon-format/toon` package)
- [ ] 5.2 Remove unused Output\* types from old output.ts
- [ ] 5.3 Verify all output formats produce valid output
- [ ] 5.4 Update any tests that depend on old serialization
