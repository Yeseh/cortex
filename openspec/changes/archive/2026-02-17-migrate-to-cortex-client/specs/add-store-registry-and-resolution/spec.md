## ADDED Requirements

### Requirement: CortexContext for handlers

The system SHALL provide a `CortexContext` interface for dependency injection into handlers:

- `cortex: Cortex` - The root client instance

#### Scenario: Handler receives context

- **GIVEN** a CLI or MCP handler function
- **WHEN** the handler is invoked
- **THEN** it receives `CortexContext` as its first parameter
- **AND** can access `ctx.cortex.getStore(name)`

## REMOVED Requirements

### Requirement: Initialize Store Domain Operation

**Reason**: Store initialization logic moves into `Cortex.initialize()` and dedicated store operations.

**Migration**: Use `Cortex.init()` followed by `cortex.initialize()` for first-time setup.
