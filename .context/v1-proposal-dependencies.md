# V1 proposal dependencies

Dependency map inferred from current OpenSpec proposals.

## Foundational
- `add-memory-core-model` is foundational for proposals that read/write memories.

## Configuration and output
- `add-config-layering` is required by `add-output-formats` and
  `add-store-registry-and-resolution` (uses `output_format` and
  `strict_local`).
- `add-output-formats` is required by CLI proposals that return output:
  `add-cli-store-management`, `add-cli-memory-operations`,
  `add-cli-discovery-and-maintenance`.

## Store resolution
- `add-store-registry-and-resolution` is required by `add-cli-store-management`
  and CLI commands that resolve stores by name (`add-cli-memory-operations`,
  `add-cli-discovery-and-maintenance`).

## Storage and indexing
- `add-storage-filesystem-adapter` is required by
  `add-cli-memory-operations`, `add-cli-discovery-and-maintenance`, and
  `add-indexing-and-reindex`.
- `add-indexing-and-reindex` is required by `add-cli-discovery-and-maintenance`
  and used by `add-storage-filesystem-adapter` when writing memory files.

## CLI proposals
- `add-cli-store-management` depends on `add-store-registry-and-resolution`,
  `add-config-layering`, and `add-output-formats`.
- `add-cli-memory-operations` depends on `add-memory-core-model`,
  `add-storage-filesystem-adapter`, `add-store-registry-and-resolution`,
  `add-output-formats`, and `add-indexing-and-reindex`.
- `add-cli-discovery-and-maintenance` depends on `add-memory-core-model`,
  `add-storage-filesystem-adapter`, `add-store-registry-and-resolution`,
  `add-output-formats`, and `add-indexing-and-reindex`.

## Standalone
- `add-tokenizer-interface` has no direct dependencies on other proposals.
