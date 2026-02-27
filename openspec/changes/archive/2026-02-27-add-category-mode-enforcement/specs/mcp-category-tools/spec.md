## MODIFIED Requirements

### Requirement: Create category tool

The MCP server SHALL conditionally provide a `cortex_create_category` tool based on store category mode. The tool is NOT registered in `strict` mode.

#### Scenario: Tool available in free mode

- **WHEN** the store is in `free` mode
- **THEN** `cortex_create_category` is registered and available to agents

#### Scenario: Tool available in subcategories mode

- **WHEN** the store is in `subcategories` mode
- **THEN** `cortex_create_category` is registered and enforces root category restrictions

#### Scenario: Tool hidden in strict mode

- **WHEN** the store is in `strict` mode
- **THEN** `cortex_create_category` is NOT registered with the MCP server
- **AND** agents cannot discover or call this tool

#### Scenario: Creating root category in subcategories mode

- **WHEN** an agent calls `cortex_create_category` with a new root path in `subcategories` mode
- **THEN** the tool returns an error listing allowed root categories

### Requirement: Delete category tool

The MCP server SHALL conditionally provide a `cortex_delete_category` tool based on store category mode. The tool is NOT registered in `strict` mode.

#### Scenario: Tool available in free mode

- **WHEN** the store is in `free` mode
- **THEN** `cortex_delete_category` is registered and available to agents

#### Scenario: Tool available in subcategories mode

- **WHEN** the store is in `subcategories` mode
- **THEN** `cortex_delete_category` is registered and available to agents

#### Scenario: Tool hidden in strict mode

- **WHEN** the store is in `strict` mode
- **THEN** `cortex_delete_category` is NOT registered with the MCP server

#### Scenario: Deleting protected category

- **WHEN** an agent calls `cortex_delete_category` on a config-defined category
- **THEN** the tool returns an error explaining the category is protected by config

### Requirement: Set category description tool

The MCP server SHALL always provide a `cortex_set_category_description` tool, but it rejects config-defined categories.

#### Scenario: Setting description on non-config category

- **WHEN** an agent calls `cortex_set_category_description` on a non-config category
- **THEN** the description is set successfully

#### Scenario: Setting description on config-defined category

- **WHEN** an agent calls `cortex_set_category_description` on a config-defined category
- **THEN** the tool returns an error explaining the category is protected by config

#### Scenario: Tool always registered

- **WHEN** the store is in any mode (free, subcategories, or strict)
- **THEN** `cortex_set_category_description` is registered with the MCP server
