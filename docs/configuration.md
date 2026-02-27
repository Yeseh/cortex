# Configuration Reference

Cortex is configured via a single YAML file. This document covers the full schema, all fields, and validation rules.

## Config File Location

| Context            | Default path                        |
| ------------------ | ----------------------------------- |
| Global (default)   | `~/.config/cortex/config.yaml`      |
| Project-local      | `.cortex/config.yaml`               |
| Custom (CLI)       | `CORTEX_CONFIG`                     |

Cortex loads the project-local config when one exists, falling back to the global config.

---

## Environment Overrides

### CLI

CLI config path resolution supports these overrides in precedence order:

1. `CORTEX_CONFIG` (absolute or relative path to `config.yaml`)
2. `CORTEX_CONFIG_DIR` (directory containing `config.yaml`)
3. Default: `~/.config/cortex/config.yaml`

### MCP Server

MCP server configuration is environment-driven and does not read `CORTEX_CONFIG`.

| Variable               | Description                                               | Default            |
| ---------------------- | --------------------------------------------------------- | ------------------ |
| `CORTEX_DATA_PATH`     | Base data path (`<path>/memory` contains store dirs)     | `~/.config/cortex` |
| `CORTEX_PORT`          | HTTP server port                                          | `3000`             |
| `CORTEX_HOST`          | HTTP bind host                                            | `0.0.0.0`          |
| `CORTEX_DEFAULT_STORE` | Default store name                                        | `default`          |
| `CORTEX_LOG_LEVEL`     | Log level (`debug`, `info`, `warn`, `error`)             | `info`             |
| `CORTEX_OUTPUT_FORMAT` | Output format (`yaml`, `json`, `toon`)                   | `yaml`             |
| `CORTEX_CATEGORY_MODE` | Category mode for default-store first-time initialization | `free`             |

Compatibility aliases:

- `CORTEX_CONFIG_PATH` → `CORTEX_DATA_PATH`
- `CORTEX_STORE` → `CORTEX_DEFAULT_STORE`

---

## Full Schema

```yaml
settings:
    defaultStore: default # Which store to use when none is specified
    outputFormat: yaml # Output format: yaml | json | toon

stores:
    <store-name>: # Lowercase slug (e.g. "default", "my-project")
        kind: filesystem # Storage backend (currently only "filesystem")
        description: '...' # Optional human-readable description
        categoryMode: free # Category creation policy: free | subcategories | strict
        properties:
            path: /absolute/path/to/memory # Required: root directory for this store
        categories: # Optional: define category hierarchy
            <category-name>:
                description: '...'
                subcategories:
                    <subcategory-name>:
                        description: '...'
```

---

## `settings`

Optional top-level section for global defaults.

| Field          | Type     | Default     | Description                                              |
| -------------- | -------- | ----------- | -------------------------------------------------------- |
| `defaultStore` | `string` | `"default"` | Store used when no `--store` flag or `store` param given |
| `outputFormat` | `string` | `"yaml"`    | CLI output format. One of `yaml`, `json`, `toon`         |

---

## `stores`

A map of named stores. Each key is a **store name** — a lowercase slug matching `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`.

Valid store names: `default`, `my-project`, `cortex`, `work-notes`  
Invalid store names: `MyProject`, `my_project`, `my project`

### Store fields

| Field          | Type     | Required | Description                                             |
| -------------- | -------- | -------- | ------------------------------------------------------- |
| `kind`         | `string` | Yes      | Storage backend. Use `"filesystem"`.                    |
| `description`  | `string` | No       | Human-readable description of what this store contains  |
| `categoryMode` | `string` | No       | Category creation policy (see below). Default: `"free"` |
| `properties`   | `object` | Yes      | Backend-specific settings. Must include `path`.         |
| `categories`   | `object` | No       | Category hierarchy definition (see below)               |

### `properties.path`

The root directory where memory files for this store are kept. Must be an absolute path.

```yaml
properties:
  path: /home/alice/.config/cortex/memory    # global default store
  # or
  path: /home/alice/projects/my-app/.cortex/memory   # project-local store
```

Cortex creates this directory on first use if it does not exist.

---

## `categoryMode`

Controls whether agents and CLI commands can create new categories freely.

| Value           | Behavior                                                          |
| --------------- | ----------------------------------------------------------------- |
| `free`          | Any category path is allowed. Default.                            |
| `subcategories` | Only subcategories of config-defined root categories are allowed. |
| `strict`        | Only paths explicitly defined in `categories` are allowed.        |

`free` is the right default for most setups. Use `strict` when you want to enforce a fixed category schema across a team.

---

## `categories`

An optional hierarchy that defines category structure for a store. Categories here are used for:

- Enforcing allowed paths when `categoryMode` is `strict` or `subcategories`
- Providing descriptions that agents can read when listing category structure

```yaml
stores:
    cortex:
        kind: filesystem
        properties:
            path: /home/alice/projects/cortex/.cortex/memory
        categories:
            standards:
                description: 'Coding standards and conventions'
                subcategories:
                    architecture:
                        description: 'Architecture patterns and decisions'
                    testing:
                        description: 'Testing conventions'
            decisions:
                description: 'Architecture Decision Records'
            runbooks:
                description: 'Debugging and operational procedures'
```

### Category field rules

| Field           | Type     | Max length | Validation                                     |
| --------------- | -------- | ---------- | ---------------------------------------------- |
| `description`   | `string` | 500 chars  | Optional. Fails validation if longer than 500. |
| `subcategories` | `object` | —          | Nested map of `<name>: category` entries.      |

Category names must be lowercase slug segments (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`). Paths are assembled from the hierarchy:

```yaml
standards: # → "standards"
    subcategories:
        architecture: # → "standards/architecture"
```

---

## Minimal Example

The simplest valid config — one store, no extra settings:

```yaml
stores:
    default:
        kind: filesystem
        properties:
            path: /home/alice/.config/cortex/memory
```

---

## Full Example

```yaml
settings:
    defaultStore: cortex
    outputFormat: yaml

stores:
    default:
        kind: filesystem
        description: 'Global: user identity and cross-project knowledge'
        properties:
            path: /home/alice/.config/cortex/memory

    cortex:
        kind: filesystem
        description: 'Project store for the Cortex repository'
        categoryMode: free
        properties:
            path: /home/alice/projects/cortex/.cortex/memory
        categories:
            standards:
                description: 'Architecture decisions and coding standards'
                subcategories:
                    architecture:
                        description: 'Hexagonal architecture patterns'
            decisions:
                description: 'Architecture Decision Records (ADRs)'
            runbooks:
                description: 'Debugging and operational procedures'
            todo:
                description: 'Outstanding work items'
            standup:
                description: 'Daily session summaries (expires after 7 days)'
```

---

## Validation Rules

Cortex validates the config on load. Common errors:

| Error                      | Cause                                                  | Fix                                                     |
| -------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| `CONFIG_VALIDATION_FAILED` | Store name not a lowercase slug                        | Use only lowercase letters, digits, hyphens             |
| `CONFIG_VALIDATION_FAILED` | Category description exceeds 500 characters            | Shorten the description                                 |
| `CONFIG_VALIDATION_FAILED` | Category name contains uppercase or special characters | Use lowercase slug names only                           |
| `CONFIG_PARSE_FAILED`      | Invalid YAML syntax                                    | Check indentation, quotes, colons                       |
| `INVALID_STORE_PATH`       | Store definition missing `properties.path`             | Add `properties: { path: /absolute/path }` to the store |
| `CONFIG_NOT_FOUND`         | Config file does not exist                             | Run `cortex init` or `cortex store init`                |

---

## Initializing a Config

`cortex init` creates a global config with a default store:

```bash
cortex init
# Creates ~/.config/cortex/config.yaml and ~/.config/cortex/memory/
```

`cortex store init` adds a project-local store inside the current git repository:

```bash
cd ~/projects/my-app
cortex store init
# Creates .cortex/config.yaml and .cortex/memory/
# Registers "my-app" store in the global config
```
