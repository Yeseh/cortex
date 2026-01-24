## ADDED Requirements
### Requirement: Output format selection
The system SHALL output memory data as YAML or JSON based on configuration.

#### Scenario: Selecting JSON output
- **WHEN** output_format is set to json
- **THEN** the system returns JSON output

### Requirement: Single memory output
The system SHALL render a memory with metadata headers followed by content.

#### Scenario: Rendering a memory
- **WHEN** a memory is shown
- **THEN** the output includes metadata and body content

### Requirement: Category output
The system SHALL list category memories and subcategories in structured output.

#### Scenario: Rendering a category
- **WHEN** a category is shown
- **THEN** the output includes memory entries and subcategories
