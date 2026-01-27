## MODIFIED Requirements

### Requirement: Output format selection

The system SHALL output memory data as YAML, JSON, or TOON based on configuration.

#### Scenario: Selecting JSON output

- **WHEN** output_format is set to json
- **THEN** the system returns JSON output

#### Scenario: Selecting TOON output

- **WHEN** output_format is set to toon
- **THEN** the system returns TOON-formatted output using tab delimiters and key folding

#### Scenario: Default format remains YAML

- **WHEN** output_format is not specified
- **THEN** the system defaults to YAML output

## ADDED Requirements

### Requirement: TOON format encoding

The system SHALL encode TOON output using the `@toon-format/toon` library with tab delimiters and safe key folding enabled.

#### Scenario: Memory metadata uses key folding

- **WHEN** a memory is rendered in TOON format
- **THEN** metadata fields use dotted path notation (e.g., `metadata.created_at`)

#### Scenario: Content field is quoted

- **WHEN** a memory with multiline content is rendered in TOON format
- **THEN** the content field is a JSON-style quoted string with escaped newlines

### Requirement: TOON tabular arrays

The system SHALL use TOON tabular format for arrays of uniform objects to maximize token efficiency.

#### Scenario: Category memories as table

- **WHEN** a category with multiple memories is rendered in TOON format
- **THEN** the memories array uses tabular format with field header (e.g., `memories[N]{path,token_estimate,summary}:`)

#### Scenario: Store registry as table

- **WHEN** a store registry with multiple stores is rendered in TOON format
- **THEN** the stores array uses tabular format with field header (e.g., `stores[N]{name,path}:`)

#### Scenario: Empty arrays

- **WHEN** an empty array is rendered in TOON format
- **THEN** the output shows length zero (e.g., `memories[0]:`)
