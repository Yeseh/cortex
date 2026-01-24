# Change: Add filesystem storage adapter

## Why
The v1 Cortex system stores data on the filesystem, which requires a dedicated adapter behind the storage interface.

## What Changes
- Define the StorageAdapter interface.
- Implement the filesystem adapter for read/write operations.

## Impact
- Affected specs: storage-filesystem
- Affected code: src/storage/adapter.ts, src/storage/filesystem
