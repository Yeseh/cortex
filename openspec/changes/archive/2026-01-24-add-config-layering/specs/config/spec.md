## ADDED Requirements
### Requirement: Layered configuration
The system SHALL load global and local configuration files and apply local overrides.

#### Scenario: Local overrides global
- **WHEN** the same key exists in both configs
- **THEN** the local value is used

### Requirement: Supported config fields
The system SHALL support output_format, auto_summary_threshold, and strict_local fields.

#### Scenario: Config validation
- **WHEN** a config file includes supported fields
- **THEN** the system loads the values without error
