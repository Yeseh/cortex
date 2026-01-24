# Change: Add output formats

## Why
Consistent output contracts are required for both CLI and future API consumers.

## What Changes
- Define YAML and JSON output formats.
- Specify output shapes for single memories and category listings.

## Impact
- Affected specs: output-format
- Affected code: src/cli/output.ts, future API serializers
