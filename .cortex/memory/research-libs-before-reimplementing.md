---
created_at: 2026-01-27T20:35:40.567Z
updated_at: 2026-01-27T20:35:40.567Z
tags: [preference, libraries, serialization, reuse]
source: mcp
---
Preference: Research and prefer existing, well-maintained libraries before implementing common logic yourself.

Context: When adding features that involve common functionality (e.g., serialization to JSON/CSV/Avro/Parquet, auth token handling, data validation, date/time parsing), first search package registries and existing internal libraries to avoid reimplementing functionality.

Acceptance: Before coding, perform a short evaluation (license, maintenance, API ergonomics, performance, tests, security) and document the chosen library or the reason for building a custom implementation.

Tags: preference, libraries, serialization, reuse