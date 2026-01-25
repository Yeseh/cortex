# Change: Add TOON Output Format for Memory Rendering

## Why

Current output formats (YAML, JSON) are not optimized for LLM context consumption. TOON (Token-Oriented Object Notation) is specifically designed for LLM prompts, achieving ~40% token reduction while improving parsing accuracy from 70% to 74% in benchmarks. This aligns with the original design vision documented in `memory-design.md` which specified TOON as the intended tool output format.

## What Changes

- Add `toon` as a third output format option alongside `yaml` and `json`
- Implement TOON serialization for all output payloads (memory, category, store, store-registry, store-init)
- Use tab delimiters for maximum token efficiency
- Use key folding to collapse metadata paths (e.g., `metadata.created_at` instead of nested structure)
- Use tabular format for arrays of uniform objects (memories, subcategories, stores)
- Keep YAML as the default format (TOON is opt-in via `--format toon` or config)

## Impact

- Affected specs: `output-format`
- Affected code:
    - `src/cli/output.ts` - Add TOON serialization functions
    - `src/server/config.ts` - Extend output format schema
    - `src/cli/commands/list.ts` - Accept `--format toon`
    - `src/cli/commands/show.ts` - Accept `--format toon` (if applicable)
- New dependency: `@toon-format/toon` (stable v2.1.0, MIT licensed)
