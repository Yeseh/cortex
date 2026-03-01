# Change: Add Category Policies

## Why

Categories need a governance system that controls memory lifecycle (expiry ceilings, content limits), permissions (create/update/delete), and structural rules (subcategory creation). Currently the only store-level `categoryMode` field is too coarse-grained and doesn't support per-category configuration. This replaces `categoryMode` with a fine-grained, inheritable policy system attached to category definitions in config.

## What Changes

- **BREAKING**: `categoryMode` field removed from store config; replaced by per-category `subcategoryCreation` policy
- New `policy-core` capability: `policy/` module in `packages/core/src` with resolution, validation, and transformation pipelines
- `config` spec updated: category definitions gain an optional `policies` block; `categoryMode` requirement removed
- `category-core` spec updated: `createCategory`, `deleteCategory`, and `setDescription` operations enforce applicable policies
- `memory-core` spec updated: `createMemory`, `updateMemory`, and `deleteMemory` operations enforce applicable policies

## Impact

- Affected specs: `config`, `category-core`, `memory-core`
- New spec: `policy-core`
- Affected code: `packages/core/src/` (new `policy/` module, updated `memory/` and `category/` operations), `packages/core/src/config/` (schema changes)
- **BREAKING**: Callers relying on `categoryMode` must migrate to per-category `subcategoryCreation` policy
