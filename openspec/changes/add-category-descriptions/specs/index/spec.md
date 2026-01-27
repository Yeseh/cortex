# index Specification

## Purpose

Defines the category index structure and storage location for organizing memories within a store.

## ADDED Requirements

### Requirement: Subcategory description field

Subcategory entries in category indexes SHALL support an optional `description` field.

#### Scenario: Subcategory with description

- **WHEN** a category index contains a subcategory with a description
- **THEN** the index includes the description in the subcategory entry

#### Scenario: Subcategory without description

- **WHEN** a category index contains a subcategory without a description
- **THEN** the subcategory entry is valid and the description field is omitted

### Requirement: Description serialization format

Category descriptions SHALL be serialized in YAML as a `description` field in subcategory entries.

#### Scenario: YAML serialization with description

- **WHEN** a subcategory entry is serialized to YAML
- **THEN** the format includes `description` field when present:
    ```yaml
    subcategories:
        - path: projects/cortex
          memory_count: 5
          description: Cortex memory system project knowledge
    ```

#### Scenario: YAML serialization without description

- **WHEN** a subcategory entry without a description is serialized
- **THEN** the `description` field is omitted from the YAML output
