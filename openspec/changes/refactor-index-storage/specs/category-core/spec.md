## MODIFIED Requirements

### Requirement: Category storage port interface

The category module SHALL define a `CategoryStorage` interface for abstract storage access. Methods SHALL use backend-agnostic names: `exists(path)`, `ensure(path)`, `delete(path)`, `updateSubcategoryDescription(parentPath, subcategoryPath, description)`, `removeSubcategoryEntry(parentPath, subcategoryPath)`. Index read/write operations are NOT part of `CategoryStorage` — they belong to `IndexStorage`.

#### Scenario: Port interface definition

- **WHEN** the category module is initialized
- **THEN** it requires a `CategoryStorage` implementation with methods `exists`, `ensure`, `delete`, `updateSubcategoryDescription`, and `removeSubcategoryEntry`
- **AND** method names do not reference filesystem concepts like "directory"

#### Scenario: No index operations on CategoryStorage

- **WHEN** a consumer needs to read or write category indexes
- **THEN** they use `IndexStorage`, not `CategoryStorage`
