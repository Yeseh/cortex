---
created_at: 2026-02-14T17:59:54.844Z
updated_at: 2026-02-14T17:59:54.844Z
tags: []
source: mcp
citations:
  - .cortex/memory/decisions/registry/registry-abstraction.md
  - .cortex/memory/decisions/registry/registry-as-store-factory.md
  - openspec/specs/add-store-registry-and-resolution/spec.md
  - openspec/changes/archive/2026-01-31-refactor-registry-abstraction/design.md
---
Title: Review current registry implementation
Why: The registry is a central piece that resolves stores, provides caching, and acts as a factory; several past proposals and decisions touch its shape. A targeted review will surface correctness, performance, and API surface issues before larger refactors.
Goal: Audit the existing registry code and documentation, produce a short report with recommended fixes (bugs, deprecations, performance improvements, API changes), and a prioritized implementation plan.
Tasks:
- Inventory usages: find all call sites across packages (core, storage-fs, cli, server) that consume the registry
- Read decisions/specs: review existing docs and past changes for intended behavior
- Static checks: identify places that rely on registry internals (e.g., store lists, caching policies)
- Benchmarks: measure registry lookup latency and cache hit/miss behavior under typical workloads
- API review: identify breaking/public API surfaces and propose non-breaking facades where possible
- Proposal: write a short tasks.md with recommended changes, timelines, and owners
- Tests & Validation: add unit/integration tests for cache correctness and concurrency scenarios
Risks & Notes:
- Registry API changes are potentially breaking — prefer deprecation shims
- Coordinate with owners of storage-fs, cli, and server before making changes
Tags: [core, registry, audit, todo]
