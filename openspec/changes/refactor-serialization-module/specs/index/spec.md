## MODIFIED Requirements

### Requirement: Index YAML format

The system SHALL store category indexes in YAML with memory entries and subcategory references. Index serialization uses the standard `yaml` library, producing valid YAML that is semantically equivalent but may differ in whitespace or formatting from hand-crafted YAML.

#### Scenario: Loading a category index

- **WHEN** a category index is loaded
- **THEN** the system returns memory and subcategory metadata

#### Scenario: Index format uses standard YAML

- **WHEN** a category index is serialized
- **THEN** the output is valid YAML produced by the `yaml` library
- **AND** the output can be parsed by any standard YAML parser

#### Scenario: Round-trip equivalence

- **WHEN** a category index is serialized and then parsed
- **THEN** the parsed data is semantically equivalent to the original
