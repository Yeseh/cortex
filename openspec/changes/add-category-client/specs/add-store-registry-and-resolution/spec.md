## ADDED Requirements

### Requirement: CategoryClient class

The system SHALL provide a `CategoryClient` class that enables fluent navigation and operations on categories. The class SHALL include:

**Properties:**

1. `readonly rawPath: string` - Canonical path with leading slash (e.g., `/standards/javascript`)

**Parsing:** 2. `parsePath(): Result<CategoryPath, PathError>` - Parse raw path to value object

**Navigation (synchronous, lazy validation):** 3. `getCategory(path: string): CategoryClient` - Get subcategory by relative path 4. `getMemory(slug: string): MemoryClient` - Get memory client for slug 5. `parent(): CategoryClient | null` - Parent category, null if root

**Lifecycle:** 6. `create(): Promise<Result<Category, CategoryError>>` - Create category on disk 7. `delete(): Promise<Result<void, CategoryError>>` - Delete category (always recursive) 8. `exists(): Promise<Result<boolean, CategoryError>>` - Check if category exists

**Metadata:** 9. `setDescription(description: string | null): Promise<Result<void, CategoryError>>` - Update description

**Listing:** 10. `listMemories(options?): Promise<Result<MemoryInfo[], CategoryError>>` - List memories 11. `listSubcategories(): Promise<Result<CategoryInfo[], CategoryError>>` - List child categories

**Store-wide operations (scoped to subtree):** 12. `reindex(): Promise<Result<ReindexResult, CategoryError>>` - Rebuild indexes 13. `prune(options?): Promise<Result<PruneResult, CategoryError>>` - Remove expired memories

#### Scenario: Root category path

- **GIVEN** a `StoreClient` instance
- **WHEN** `rootCategory()` is called
- **THEN** it returns `CategoryClient` with `rawPath` equal to "/"

#### Scenario: Canonical path format

- **GIVEN** a root category
- **WHEN** `getCategory('standards')` is called
- **THEN** the returned client has `rawPath` equal to "/standards"

#### Scenario: Path normalization - leading slash

- **GIVEN** a root category
- **WHEN** `getCategory('/standards')` is called (with leading slash)
- **THEN** the returned client has `rawPath` equal to "/standards"

#### Scenario: Path normalization - trailing slash

- **GIVEN** a root category
- **WHEN** `getCategory('standards/')` is called (with trailing slash)
- **THEN** the returned client has `rawPath` equal to "/standards"

#### Scenario: Path normalization - multiple slashes

- **GIVEN** a root category
- **WHEN** `getCategory('standards//javascript')` is called
- **THEN** the returned client has `rawPath` equal to "/standards/javascript"

#### Scenario: Nested navigation

- **GIVEN** a category client with `rawPath` "/standards"
- **WHEN** `getCategory('javascript')` is called
- **THEN** the returned client has `rawPath` equal to "/standards/javascript"

#### Scenario: Parent of nested category

- **GIVEN** a category client with `rawPath` "/standards/javascript"
- **WHEN** `parent()` is called
- **THEN** it returns a `CategoryClient` with `rawPath` equal to "/standards"

#### Scenario: Parent of depth-1 category

- **GIVEN** a category client with `rawPath` "/standards"
- **WHEN** `parent()` is called
- **THEN** it returns a `CategoryClient` with `rawPath` equal to "/"

#### Scenario: Parent of root category

- **GIVEN** a category client with `rawPath` "/"
- **WHEN** `parent()` is called
- **THEN** it returns null

#### Scenario: Lazy validation - valid path

- **GIVEN** a category client created with valid path "standards/javascript"
- **WHEN** `exists()` is called
- **THEN** the path is validated successfully
- **AND** the operation proceeds

#### Scenario: Lazy validation - invalid path

- **GIVEN** a category client created with invalid path "INVALID PATH!!!"
- **WHEN** `exists()` is called
- **THEN** it returns error with code `INVALID_PATH`

#### Scenario: Create category

- **GIVEN** a category client for path "/standards/typescript"
- **WHEN** `create()` is called
- **THEN** the category is created on disk
- **AND** it returns `Result<Category, CategoryError>`

#### Scenario: Delete category is recursive

- **GIVEN** a category with subcategories and memories
- **WHEN** `delete()` is called
- **THEN** the category and all contents are deleted

#### Scenario: List subcategories

- **GIVEN** a category with subcategories "api" and "utils"
- **WHEN** `listSubcategories()` is called
- **THEN** it returns `CategoryInfo[]` for both subcategories

#### Scenario: Reindex scoped to subtree

- **GIVEN** a category client for "/standards"
- **WHEN** `reindex()` is called
- **THEN** only indexes under "/standards" are rebuilt

#### Scenario: Prune scoped to subtree

- **GIVEN** a category client for "/archive"
- **WHEN** `prune()` is called
- **THEN** only expired memories under "/archive" are removed
