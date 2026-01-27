## ADDED Requirements

### Requirement: Memory migration script

The system SHALL provide a one-time migration script to transfer memories from the OpenCode memory system to Cortex filesystem storage.

#### Scenario: Migrate global memories

- **WHEN** the migration script is executed with default settings
- **THEN** all global memories (persona, human blocks) are migrated to `global/<block>/<slug>` paths
- **AND** timestamps are preserved in ISO 8601 format
- **AND** tags are converted to YAML array format
- **AND** source field is set to "opencode-migration"

#### Scenario: Generate meaningful slugs

- **WHEN** a memory with content "User prefers PowerShell Core for scripting" is migrated
- **THEN** the generated slug contains significant words like "powershell-core-scripting"
- **AND** stopwords are excluded from the slug

#### Scenario: Handle slug collisions

- **WHEN** two memories would generate the same slug
- **THEN** the second memory receives a suffix (e.g., `slug-2`)
- **AND** no data is lost

#### Scenario: Dry run mode

- **WHEN** the migration script is executed with `--dry-run` flag
- **THEN** no files are written to disk
- **AND** the script reports what would be migrated

#### Scenario: Reindex after migration

- **WHEN** the migration completes successfully
- **THEN** category indexes are rebuilt to include migrated memories
