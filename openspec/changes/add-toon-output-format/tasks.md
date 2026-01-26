## 1. Dependencies & Schema

- [x] 1.1 ~~Add `@toon-format/toon` to package.json dependencies~~ (Custom implementation in `src/cli/toon.ts`)
- [x] 1.2 Extend `outputFormatSchema` in `src/server/config.ts` to include `'toon'`
- [x] 1.3 Update `OutputFormat` type in `src/cli/output.ts` to include `'toon'`

## 2. Core Serialization

- [x] 2.1 Add `serializeMemoryToon()` function with key-folded metadata and quoted content
- [x] 2.2 Add `serializeCategoryToon()` function with tabular arrays for memories/subcategories
- [x] 2.3 Add `serializeStoreToon()` function
- [x] 2.4 Add `serializeStoreRegistryToon()` function with tabular store list
- [x] 2.5 Add `serializeStoreInitToon()` function
- [x] 2.6 Add `serializeToonOutput()` router function
- [x] 2.7 Integrate TOON into `serializeOutput()` switch statement

## 3. CLI Integration

- [x] 3.1 Update `--format` validation in `src/cli/commands/list.ts` to accept `toon`
- [x] 3.2 Update format handling in show command if applicable

## 4. Testing

- [x] 4.1 Add unit tests for `serializeMemoryToon()`
- [x] 4.2 Add unit tests for `serializeCategoryToon()`
- [x] 4.3 Add unit tests for `serializeStoreToon()` and `serializeStoreRegistryToon()`
- [x] 4.4 Add unit tests for `serializeStoreInitToon()`
- [x] 4.5 ~~Add round-trip tests (encode with TOON library, decode, compare)~~ - N/A: Custom encoder, no decoder needed
- [x] 4.6 Add edge case tests: empty arrays, special characters, missing optional fields
- [x] 4.7 Update server config tests to allow `toon` as valid format
- [x] 4.8 Add integration tests for `--format toon` CLI flag

## 5. Documentation

- [x] 5.1 Update CLI help text for `--format` option
- [x] 5.2 Add TOON format examples to toon.ts module documentation
