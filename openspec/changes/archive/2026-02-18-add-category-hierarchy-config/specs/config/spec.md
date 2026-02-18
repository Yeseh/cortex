## ADDED Requirements

### Requirement: Category mode configuration

Each store definition SHALL support a `categoryMode` field that controls category creation/deletion permissions. Valid values are `free`, `subcategories`, and `strict`. The default is `free` if not specified.

#### Scenario: Store with explicit category mode

- **WHEN** a store config includes `categoryMode: strict`
- **THEN** the system loads the store with strict mode enforcement

#### Scenario: Store without category mode

- **WHEN** a store config omits `categoryMode`
- **THEN** the system defaults to `free` mode

#### Scenario: Invalid category mode

- **WHEN** a store config includes an invalid `categoryMode` value
- **THEN** config parsing returns a validation error

### Requirement: Category hierarchy definition

Each store definition SHALL support a `categories` field containing a nested hierarchy of category definitions. Each category definition MAY include a `description` (string, max 500 chars) and `subcategories` (nested definitions).

#### Scenario: Store with category hierarchy

- **WHEN** a store config includes a `categories` block with nested definitions
- **THEN** the system parses the full hierarchy including descriptions

#### Scenario: Category without description

- **WHEN** a category definition uses empty object `{}` or omits `description`
- **THEN** the category is parsed with no description but remains valid

#### Scenario: Deeply nested categories

- **WHEN** a store config defines categories at arbitrary nesting depth
- **THEN** all levels are parsed and accessible

#### Scenario: Category description too long

- **WHEN** a category description exceeds 500 characters
- **THEN** config parsing returns a validation error

### Requirement: Config-defined category path resolution

The system SHALL provide a function to determine if a category path is defined in config. All ancestors of explicitly defined categories are implicitly config-defined.

#### Scenario: Explicitly defined category

- **WHEN** config defines `standards/architecture`
- **THEN** `isConfigDefined("standards/architecture")` returns true

#### Scenario: Ancestor of defined category

- **WHEN** config defines `standards/architecture`
- **THEN** `isConfigDefined("standards")` returns true (implicit ancestor)

#### Scenario: Non-config category

- **WHEN** config does not define `legacy` or any descendant
- **THEN** `isConfigDefined("legacy")` returns false
