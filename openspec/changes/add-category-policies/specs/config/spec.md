## REMOVED Requirements

### Requirement: Category mode configuration

**Reason**: `categoryMode` is replaced by per-category `subcategoryCreation` policy. The new policy system is more granular, inheritable, and does not require a distinct enum type. No deprecation path — callers must migrate to the `policies.subcategoryCreation` field in category definitions.
**Migration**: Replace `categoryMode: strict` or `categoryMode: subcategories` on a store with `policies: { subcategoryCreation: false }` on each category that should not allow new subcategories.

## MODIFIED Requirements

### Requirement: Category hierarchy definition

Each store definition SHALL support a `categories` field containing a nested hierarchy of category definitions. Each category definition MAY include:

- `description` (string, max 500 chars)
- `subcategories` (nested category definitions)
- `policies` (optional policy block — see Category Policies requirement)

#### Scenario: Store with category hierarchy

- **WHEN** a store config includes a `categories` block with nested definitions
- **THEN** the system parses the full hierarchy including descriptions and policies

#### Scenario: Category without description

- **WHEN** a category definition uses empty object `{}` or omits `description`
- **THEN** the category is parsed with no description but remains valid

#### Scenario: Deeply nested categories

- **WHEN** a store config defines categories at arbitrary nesting depth
- **THEN** all levels are parsed and accessible

#### Scenario: Category description too long

- **WHEN** a category description exceeds 500 characters
- **THEN** config parsing returns a validation error

#### Scenario: Category with policies block

- **WHEN** a category definition includes a `policies` block
- **THEN** the policies are parsed and associated with that category path

#### Scenario: Category without policies block

- **WHEN** a category definition omits `policies`
- **THEN** the category has no configured policies (system defaults apply at runtime)

## ADDED Requirements

### Requirement: Category policy configuration

Each category definition in a store's `categories` block MAY include an optional `policies` block. The `policies` block SHALL support the following fields, all optional:

- `defaultTtl` (number, days) — ceiling on memory expiry using `min(explicit, defaultTtl)` semantics
- `maxContentLength` (number, characters) — maximum memory content length
- `permissions.create` (boolean, default `true`) — whether new memories may be created
- `permissions.update` (boolean, default `true`) — whether existing memories may be updated
- `permissions.delete` (boolean, default `true`) — whether memories may be deleted
- `subcategoryCreation` (boolean, default `true`) — whether new subcategories may be created

The `permissions` field supports partial declaration: unspecified permission fields default to `true`.

#### Scenario: Category with full policies block

- **WHEN** a category definition includes `policies` with all supported fields
- **THEN** all fields are parsed and stored without error

#### Scenario: Category with partial permissions

- **WHEN** a category definition includes `policies: { permissions: { delete: false } }`
- **THEN** `create` and `update` default to `true` and `delete` is `false`

#### Scenario: Category with defaultTtl

- **WHEN** a category definition includes `policies: { defaultTtl: 7 }`
- **THEN** the parsed policy has `defaultTtl: 7`

#### Scenario: Category with invalid policy field type

- **WHEN** a category definition includes `policies: { defaultTtl: "seven" }`
- **THEN** config parsing returns a validation error

#### Scenario: Subcategory inherits parent policies at runtime

- **WHEN** a parent category defines policies and a subcategory does not
- **THEN** the subcategory inherits the parent's policies at runtime (resolved by the policy module, not stored in config)
