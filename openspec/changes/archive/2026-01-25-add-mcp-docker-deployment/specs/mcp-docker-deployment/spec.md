# mcp-docker-deployment Specification

## Purpose

Docker containerization for the MCP server, enabling easy deployment and integration with container orchestration systems.

## ADDED Requirements

### Requirement: Docker image

The project SHALL provide a Dockerfile that builds a container image for the MCP server.

#### Scenario: Building the image

- **WHEN** a user runs `docker build`
- **THEN** a container image is created with all dependencies

#### Scenario: Image defaults

- **WHEN** the container starts without environment overrides
- **THEN** the server uses `/data` as the data path and listens on port 3000

### Requirement: Docker Compose configuration

The project SHALL provide a docker-compose.yaml for production deployment.

#### Scenario: Starting with docker-compose

- **WHEN** a user runs `docker-compose up`
- **THEN** the MCP server starts with a persistent volume for data

#### Scenario: Port configuration

- **WHEN** a user sets `CORTEX_PORT` environment variable
- **THEN** the host port mapping uses the specified value

#### Scenario: Health check

- **WHEN** the container is running
- **THEN** Docker monitors health via the `/health` endpoint

### Requirement: Local development support

The project SHALL provide a docker-compose.override.yaml template for local development.

#### Scenario: Local volume mounting

- **WHEN** a developer uses the override file
- **THEN** local `./data` directory is mounted into the container

#### Scenario: Environment file support

- **WHEN** a `.env` file exists
- **THEN** environment variables are loaded from the file

### Requirement: Data persistence

The MCP server container SHALL persist data across restarts via Docker volumes.

#### Scenario: Container restart

- **WHEN** the container is stopped and restarted
- **THEN** all memory data is preserved

#### Scenario: Volume backup

- **WHEN** a user needs to backup data
- **THEN** the named volume can be backed up using standard Docker volume tools
