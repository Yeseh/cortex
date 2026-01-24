# Change: Add configuration layering

## Why
Users need configuration defaults and per-store overrides without duplicating settings.

## What Changes
- Define global and local configuration files.
- Specify merge rules where local overrides global.
- Define core configuration fields.

## Impact
- Affected specs: config
- Affected code: src/core/config.ts
