## MODIFIED Requirements

### Requirement: Environment-based configuration

The MCP server SHALL be fully configurable via environment variables without requiring config files. The default store name SHALL be `'default'`.

#### Scenario: Server starts with defaults

- **WHEN** the server starts without environment variables set
- **THEN** the server uses default values for all configuration options including `defaultStore: 'default'`, `logLevel: 'info'`, and `otelEnabled: false`

#### Scenario: Custom configuration

- **WHEN** environment variables are set (e.g., `CORTEX_PORT=8080`)
- **THEN** the server uses the provided values

#### Scenario: Invalid configuration

- **WHEN** an invalid value is provided (e.g., `CORTEX_PORT=not-a-number`)
- **THEN** the server fails to start with a clear error message

#### Scenario: Default store name

- **WHEN** `CORTEX_DEFAULT_STORE` is not set
- **THEN** the server uses `'default'` as the default store name

#### Scenario: OTel enabled via env var

- **WHEN** `CORTEX_OTEL_ENABLED=true` is set
- **THEN** the server bootstraps OTel providers and emits spans and log records to the console exporter

#### Scenario: Log level configured via env var

- **WHEN** `CORTEX_LOG_LEVEL=debug` is set
- **THEN** debug-level log records are emitted; when `CORTEX_LOG_LEVEL=warn`, only warn and error records are emitted
