# tokenizer Specification

## Purpose
TBD - created by archiving change add-tokenizer-interface. Update Purpose after archive.
## Requirements
### Requirement: Tokenizer interface
The system SHALL expose a tokenizer interface that returns a deterministic token estimate for a given string.

#### Scenario: Estimating tokens
- **WHEN** a caller passes content to the tokenizer
- **THEN** the tokenizer returns a numeric estimate

### Requirement: Heuristic estimator
The system SHALL provide a default heuristic tokenizer for v1 deployments.

#### Scenario: Using the default tokenizer
- **WHEN** no explicit tokenizer is configured
- **THEN** the system uses the heuristic estimator

