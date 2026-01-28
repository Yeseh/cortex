## Context

The Cortex codebase has three separate serialization/deserialization implementations:

1. Generic serialize in `core/serialize.ts` (JSON, YAML, TOON output only)
2. Custom YAML-like parser in `core/index/parser.ts` (575 lines)
3. YAML frontmatter parser in `core/memory/formats/frontmatter.ts` (441 lines)

This violates DRY and places format concerns in wrong modules.

## Goals / Non-Goals

**Goals:**

- Single serialization module handling both serialize and deserialize
- Use `yaml` library instead of hand-rolled parsing
- Remove 1000+ lines of custom parsing code
- Correct module boundaries (formats belong in storage, not domain)

**Non-Goals:**

- Changing the memory domain model
- Splitting the filesystem adapter (separate proposal)
- Changing CLI output formatting behavior

## Decisions

### Decision: Use `yaml` library for all YAML operations

**Why:** Already a dependency, well-tested, handles edge cases we might miss.
**Alternatives:** Keep custom parser (rejected - maintenance burden), use `js-yaml` (rejected - `yaml` already in deps).

### Decision: Add Zod schemas for parsed data validation

**Why:** Type-safe parsing with good error messages, already used in frontmatter.ts.
**Alternatives:** Manual validation (rejected - error-prone), io-ts (rejected - less familiar).

### Decision: Inline frontmatter in filesystem adapter temporarily

**Why:** Frontmatter is filesystem-specific but we're not splitting the adapter yet.
**Alternatives:** Create separate frontmatter module in storage (deferred to filesystem split proposal).

### Decision: Accept index format changes

**Why:** YAML library output differs slightly (whitespace, quoting) but is semantically equivalent. Worth it to delete 575 lines of custom code.
**Alternatives:** Match exact output format (rejected - would require custom serialization defeating purpose).

## Risks / Trade-offs

| Risk                                               | Mitigation                                                |
| -------------------------------------------------- | --------------------------------------------------------- |
| Index format changes break tooling                 | Run round-trip tests, verify semantic equivalence         |
| Performance regression from YAML lib               | Benchmark if needed, likely negligible for our data sizes |
| Breaking change for consumers of `parseMemoryFile` | Deprecation warnings already in place, update docs        |

## Migration Plan

1. **Phase 1:** Create new serialization module alongside existing code
2. **Phase 2:** Add new index serialization with parallel tests
3. **Phase 3:** Update all consumers to use new module
4. **Phase 4:** Delete old modules after all tests pass
5. **Rollback:** Git revert if issues found

## Open Questions

- Should TOON format also support deserialization? (Probably not needed, output-only format)
- Should we add streaming support for large files? (YAGNI for now)
