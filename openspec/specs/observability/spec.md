# observability Specification

## Purpose
TBD - created by archiving change add-opentelemetry. Update Purpose after archive.
## Requirements
### Requirement: Logger port interface

The system SHALL define a `Logger` interface in `@yeseh/cortex-core` that provides `debug`, `info`, `warn`, and `error` methods. This interface is the only logging abstraction that core and handler code depend on; implementations are provided by entrypoints.

#### Scenario: Logger injected into CortexContext

- **WHEN** a `CortexContext` is created by the server or CLI factory
- **THEN** the context contains a `logger` field satisfying the `Logger` interface

#### Scenario: No logger provided

- **WHEN** a `CortexContext` is assembled without a logger (e.g., in tests)
- **THEN** the `logger` field is `undefined` and callers that guard with `ctx.logger?.info(...)` produce no output

### Requirement: NoopLogger

The system SHALL provide a `NoopLogger` exported from `@yeseh/cortex-core` that implements `Logger` with all methods as no-ops. It is the safe default for testing and embedding contexts where logging is unwanted.

#### Scenario: NoopLogger silences all output

- **WHEN** a `NoopLogger` instance is used in place of a real logger
- **THEN** no output is produced on any stream for any log level

### Requirement: OTel-backed logger (MCP server)

When `CORTEX_OTEL_ENABLED=true`, the MCP server SHALL bootstrap an OpenTelemetry `LoggerProvider` with a `ConsoleLogRecordExporter` and use it to emit structured log records. Log level filtering SHALL respect `CORTEX_LOG_LEVEL`.

#### Scenario: OTel enabled, log emitted

- **WHEN** `CORTEX_OTEL_ENABLED=true` and a handler calls `ctx.logger.info('msg')`
- **THEN** a JSON log record appears on stdout via `ConsoleLogRecordExporter`

#### Scenario: OTel disabled (default), log emitted

- **WHEN** `CORTEX_OTEL_ENABLED` is unset or `false` and a handler calls `ctx.logger.info('msg')`
- **THEN** a structured JSON line is written to stderr by the plain `ConsoleLogger`

#### Scenario: Log level filtering

- **WHEN** `CORTEX_LOG_LEVEL=warn` and a handler calls `ctx.logger.info('msg')`
- **THEN** no output is produced for `info` or `debug` level messages

### Requirement: Span-per-MCP-tool-call (MCP server)

When `CORTEX_OTEL_ENABLED=true`, the MCP server SHALL create one OpenTelemetry span per MCP tool invocation using a `TracerProvider` backed by `ConsoleSpanExporter`. Each span SHALL record the tool name and result status as attributes.

#### Scenario: Successful tool call produces span

- **WHEN** `CORTEX_OTEL_ENABLED=true` and an MCP tool call completes successfully
- **THEN** a span is exported to stdout with `rpc.method` = tool name and `error` = `false`

#### Scenario: Failed tool call produces span with error

- **WHEN** `CORTEX_OTEL_ENABLED=true` and an MCP tool call returns an error result
- **THEN** the span is exported with `error` = `true` and an `error.type` attribute set to the domain error code

#### Scenario: OTel disabled, no spans emitted

- **WHEN** `CORTEX_OTEL_ENABLED=false`
- **THEN** no spans are created or exported

### Requirement: Console logger (CLI)

The CLI SHALL inject a plain `ConsoleLogger` (no OTel SDK dependency) into `CortexContext`. It writes structured JSON lines to stderr. Debug output is gated by the `DEBUG=cortex` environment variable.

#### Scenario: CLI logger writes to stderr

- **WHEN** the CLI creates a `CortexContext` and `ctx.logger.warn('msg')` is called
- **THEN** a JSON log line appears on stderr, not stdout

#### Scenario: Debug output gated by env var

- **WHEN** `DEBUG=cortex` is set and `ctx.logger.debug('msg')` is called
- **THEN** the debug message is written to stderr

#### Scenario: Debug suppressed by default

- **WHEN** `DEBUG` is not set and `ctx.logger.debug('msg')` is called
- **THEN** no output is produced

