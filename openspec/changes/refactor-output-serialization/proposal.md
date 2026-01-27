# Change: Refactor output serialization to generic library-based approach

## Why

The current `src/cli/output.ts` (926 lines) has grown unwieldy due to:

1. Type-specific serialization logic duplicated across formats (YAML, JSON, TOON)
2. Inline validation that should be handled at domain object construction time
3. CLI-layer placement for what is essentially core `toString(format)` functionality

This refactoring simplifies serialization to a generic approach where any valid object can be serialized using standard libraries.

## What Changes

- **BREAKING**: Remove custom YAML formatting (comments like `# path`, frontmatter `---`)
- Replace custom YAML serialization with the `yaml` library (already a dependency)
- Replace custom TOON encoder (`src/cli/toon.ts`) with `@toon-format/toon` package
- Create a single generic `serialize(obj, format)` function that works on any object
- Move serialization logic from CLI layer to core library
- Remove type-specific switch dispatching (`serializeMemoryYaml`, `serializeCategoryJson`, etc.)

## Impact

- Affected specs: `output-format`
- Affected code:
    - `src/cli/output.ts` - Major refactor (926 lines → ~50 lines)
    - `src/cli/toon.ts` - Delete (replaced by `@toon-format/toon` package)
    - `src/core/` - New `serialize.ts` module
    - `package.json` - Add `@toon-format/toon` dependency
    - CLI commands - Update imports to use core serialization
