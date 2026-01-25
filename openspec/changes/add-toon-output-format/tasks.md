## 1. Dependencies & Schema

- [ ] 1.1 Add `@toon-format/toon` to package.json dependencies
- [ ] 1.2 Extend `outputFormatSchema` in `src/server/config.ts` to include `'toon'`
- [ ] 1.3 Update `OutputFormat` type in `src/cli/output.ts` to include `'toon'`

## 2. Core Serialization

- [ ] 2.1 Add `serializeMemoryToon()` function with key-folded metadata and quoted content
- [ ] 2.2 Add `serializeCategoryToon()` function with tabular arrays for memories/subcategories
- [ ] 2.3 Add `serializeStoreToon()` function
- [ ] 2.4 Add `serializeStoreRegistryToon()` function with tabular store list
- [ ] 2.5 Add `serializeStoreInitToon()` function
- [ ] 2.6 Add `serializeToonOutput()` router function
- [ ] 2.7 Integrate TOON into `serializeOutput()` switch statement

## 3. CLI Integration

- [ ] 3.1 Update `--format` validation in `src/cli/commands/list.ts` to accept `toon`
- [ ] 3.2 Update format handling in show command if applicable

## 4. Testing

- [ ] 4.1 Add unit tests for `serializeMemoryToon()`
- [ ] 4.2 Add unit tests for `serializeCategoryToon()`
- [ ] 4.3 Add unit tests for `serializeStoreToon()` and `serializeStoreRegistryToon()`
- [ ] 4.4 Add unit tests for `serializeStoreInitToon()`
- [ ] 4.5 Add round-trip tests (encode with TOON library, decode, compare)
- [ ] 4.6 Add edge case tests: empty arrays, special characters, missing optional fields
- [ ] 4.7 Update server config tests to allow `toon` as valid format
- [ ] 4.8 Add integration tests for `--format toon` CLI flag

## 5. Documentation

- [ ] 5.1 Update CLI help text for `--format` option
- [ ] 5.2 Add TOON format examples to config documentation (if exists)
