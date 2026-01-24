# Change: Add indexing and reindex

## Why
Indexes provide fast discovery of memories and categories without scanning the filesystem on every read.

## What Changes
- Define the index file format for categories.
- Update indexes on write operations.
- Provide a manual reindex command to repair indexes.

## Impact
- Affected specs: index
- Affected code: src/index, src/storage/filesystem
