## MODIFIED Requirements

### Requirement: Output format selection

The system SHALL serialize any object to YAML, JSON, or TOON format using a generic `serialize(obj, format)` function.

#### Scenario: Selecting JSON output

- **WHEN** format is set to json
- **THEN** the system returns JSON output using `JSON.stringify`

#### Scenario: Selecting YAML output

- **WHEN** format is set to yaml
- **THEN** the system returns YAML output using the `yaml` library

#### Scenario: Selecting TOON output

- **WHEN** format is set to toon
- **THEN** the system returns TOON-formatted output using the `@toon-format/toon` library with tab delimiters and key folding

#### Scenario: Default format remains YAML

- **WHEN** format is not specified
- **THEN** the system defaults to YAML output

### Requirement: Single memory output

The system SHALL render a memory object with its metadata and content fields.

#### Scenario: Rendering a memory

- **WHEN** a memory object is serialized
- **THEN** the output includes path, metadata, and content fields in the chosen format

### Requirement: Category output

The system SHALL render a category object with its memories and subcategories.

#### Scenario: Rendering a category

- **WHEN** a category object is serialized
- **THEN** the output includes path, memories array, and subcategories array in the chosen format

### Requirement: TOON format encoding

The system SHALL encode TOON output using the `@toon-format/toon` library with tab delimiters and safe key folding enabled.

#### Scenario: Memory metadata uses key folding

- **WHEN** a memory is rendered in TOON format
- **THEN** metadata fields use dotted path notation (e.g., `metadata.created_at`)

#### Scenario: Content field is quoted

- **WHEN** a memory with multiline content is rendered in TOON format
- **THEN** the content field is a JSON-style quoted string with escaped newlines

## REMOVED Requirements

### Requirement: Custom YAML formatting

**Reason**: Custom YAML formatting (comment headers like `# path`, frontmatter separators `---`) is removed in favor of standard library output for maintainability and consistency.

**Migration**: Output will use standard YAML format. Scripts parsing the old format should be updated to parse standard YAML.

### Requirement: Custom TOON encoder

**Reason**: The custom TOON encoder (`src/cli/toon.ts`, 454 lines) is replaced by the `@toon-format/toon` package to follow the principle of using existing libraries for common functionality.

**Migration**: No external API changes. The `@toon-format/toon` package provides the same encoding capabilities.
