## Context

TOON (Token-Oriented Object Notation) is a compact encoding of the JSON data model optimized for LLM prompts. It achieves ~40% token reduction vs JSON while improving parsing accuracy. The official TypeScript implementation (`@toon-format/toon` v2.1.0) is stable and MIT licensed.

Reference: https://toonformat.dev/

## Goals / Non-Goals

**Goals:**

- Add TOON as an opt-in output format for token-efficient memory rendering
- Maximize token efficiency using tab delimiters and key folding
- Maintain full data fidelity (lossless round-trip with JSON data model)
- Reuse existing validation logic; only change serialization format

**Non-Goals:**

- Make TOON the default format (YAML remains default for human readability)
- Implement TOON parsing/decoding (Cortex only needs to produce TOON output)
- Custom TOON implementation (use official library)

## Decisions

### Decision 1: Use tab delimiters

**What:** Configure TOON encoder with `delimiter: '\t'` instead of default comma.
**Why:** Tab delimiters tokenize more efficiently (~10% additional savings). Tabs rarely appear in memory content, reducing quoting needs.

### Decision 2: Enable key folding

**What:** Configure TOON encoder with `keyFolding: 'safe'`.
**Why:** Collapses nested metadata paths into dotted notation (e.g., `metadata.created_at` instead of nested YAML structure), reducing structural tokens.

### Decision 3: Quoted content field

**What:** Memory content (which may contain markdown with newlines) will be serialized as a JSON-style quoted string with `\n` escapes.
**Why:** Keeps content on a single logical line in TOON output. Simpler than investigating TOON multiline handling. Content is typically consumed as a string anyway.

### Decision 4: Tabular arrays for uniform data

**What:** Use TOON's tabular format for arrays of uniform objects (memories, subcategories, stores).
**Why:** Tabular format declares field names once in header, then streams row values. Significantly reduces tokens for list outputs.

Example:

```
memories[2	]{path	token_estimate	summary}:
	eslint-config	234	ESLint configuration
	naming-conventions	156
```

### Decision 5: Reuse existing validation

**What:** Call the same validation functions (`validateRequiredPath`, `serializeTimestamp`, `serializeTags`, etc.) before TOON encoding.
**Why:** Ensures consistent error handling across all formats. Validation logic is format-agnostic.

## Alternatives Considered

### Alternative: Custom minimal serializer

Could implement a minimal TOON subset without the library.
**Rejected:** The library is small (~15KB), well-tested, and handles edge cases (quoting, escaping, type normalization) correctly. Custom implementation would be error-prone.

### Alternative: Make TOON the default

Could change default output format from YAML to TOON for better LLM integration.
**Rejected:** YAML is more human-readable for CLI usage. TOON is opt-in for contexts where token efficiency matters (e.g., agent tools, MCP resources).

### Alternative: Comma delimiters

Could use default comma delimiters for familiarity.
**Rejected:** Tab delimiters provide measurable token savings and are equally LLM-friendly. Since TOON output is primarily for machine consumption, human familiarity is less important.

## Risks / Trade-offs

| Risk                             | Likelihood | Impact | Mitigation                                                                    |
| -------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------- |
| TOON library has bugs            | Low        | Medium | Use stable v2.1.0, comprehensive test coverage                                |
| LLMs unfamiliar with TOON        | Low        | Low    | TOON designed for LLMs, similar to YAML, explicit length markers help parsing |
| Breaking changes in TOON spec    | Low        | Medium | Pin to specific version, update consciously                                   |
| Tab characters in memory content | Medium     | Low    | TOON automatically quotes strings containing delimiters                       |

## Migration Plan

No migration needed. This is an additive change:

- New format option `toon` added to existing `yaml | json` enum
- Default format unchanged (YAML)
- No data format changes, no database migrations

## Open Questions

None - all decisions finalized based on user preferences:

- Keep YAML as default everywhere
- Use quoted strings for content
- Use tab delimiters for efficiency
