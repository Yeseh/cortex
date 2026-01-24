# Change: Add store registry and resolution

## Why
Users need a predictable way to reference multiple memory stores without coupling to absolute paths.

## What Changes
- Define the store registry file format.
- Specify named store resolution and strict-local fallback behavior.

## Impact
- Affected specs: store-registry
- Affected code: src/store/registry.ts, src/store/store.ts, src/core/config.ts
