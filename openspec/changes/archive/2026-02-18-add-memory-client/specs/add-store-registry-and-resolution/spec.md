## ADDED Requirements

### Requirement: MemoryClient class

The system SHALL provide a `MemoryClient` class that enables fluent operations on individual memories. The class SHALL include:

**Properties:**

1. `readonly rawPath: string` - Full path including category (e.g., `/standards/javascript/style`)
2. `readonly rawSlug: string` - Memory name only (e.g., `style`)

**Parsing:** 3. `parsePath(): Result<MemoryPath, PathError>` - Parse raw path to value object 4. `parseSlug(): Result<Slug, PathError>` - Parse raw slug to value object

**Lifecycle (lazy validation):** 5. `create(input: CreateMemoryInput): Promise<Result<Memory, MemoryError>>` - Create memory 6. `get(options?: GetMemoryOptions): Promise<Result<Memory, MemoryError>>` - Retrieve memory 7. `update(input: UpdateMemoryInput): Promise<Result<Memory, MemoryError>>` - Update memory 8. `delete(): Promise<Result<void, MemoryError>>` - Remove memory 9. `exists(): Promise<Result<boolean, MemoryError>>` - Check if memory exists

**Movement:** 10. `move(destination: MemoryClient | MemoryPath): Promise<Result<MemoryClient, MemoryError>>` - Move memory

#### Scenario: MemoryClient path and slug

- **GIVEN** a category client for "/standards/javascript"
- **WHEN** `getMemory('style')` is called
- **THEN** the returned `MemoryClient` has `rawPath` "/standards/javascript/style"
- **AND** `rawSlug` equals "style"

#### Scenario: Parse path

- **GIVEN** a `MemoryClient` with `rawPath` "/standards/javascript/style"
- **WHEN** `parsePath()` is called
- **THEN** it returns `Result.ok(MemoryPath)` with correct segments

#### Scenario: Parse slug

- **GIVEN** a `MemoryClient` with `rawSlug` "style"
- **WHEN** `parseSlug()` is called
- **THEN** it returns `Result.ok(Slug)` with value "style"

#### Scenario: Lazy validation - valid slug

- **GIVEN** a `MemoryClient` created with valid slug "style-guide"
- **WHEN** `get()` is called
- **THEN** the slug is validated successfully
- **AND** the operation proceeds

#### Scenario: Lazy validation - invalid slug

- **GIVEN** a `MemoryClient` created with invalid slug "INVALID SLUG!!!"
- **WHEN** `get()` is called
- **THEN** it returns error with code `INVALID_PATH`

#### Scenario: Create memory

- **GIVEN** a `MemoryClient` for "/standards/typescript/style"
- **WHEN** `create({ content: '# Style Guide' })` is called
- **THEN** the memory is created on disk
- **AND** it returns `Result<Memory, MemoryError>`

#### Scenario: Get memory

- **GIVEN** a `MemoryClient` for an existing memory
- **WHEN** `get()` is called
- **THEN** it returns `Result<Memory, MemoryError>` with content and metadata

#### Scenario: Get memory with expiration filtering

- **GIVEN** a `MemoryClient` for an expired memory
- **WHEN** `get()` is called without options
- **THEN** it returns error with code `MEMORY_EXPIRED`

#### Scenario: Get memory including expired

- **GIVEN** a `MemoryClient` for an expired memory
- **WHEN** `get({ includeExpired: true })` is called
- **THEN** it returns the memory content

#### Scenario: Update memory

- **GIVEN** a `MemoryClient` for an existing memory
- **WHEN** `update({ content: 'new content' })` is called
- **THEN** the memory is updated on disk
- **AND** it returns the updated `Memory`

#### Scenario: Delete memory

- **GIVEN** a `MemoryClient` for an existing memory
- **WHEN** `delete()` is called
- **THEN** the memory is removed from disk

#### Scenario: Check memory exists

- **GIVEN** a `MemoryClient` for path "/standards/style"
- **WHEN** `exists()` is called
- **THEN** it returns `Result<boolean, MemoryError>`

#### Scenario: Move memory to MemoryClient destination

- **GIVEN** a `MemoryClient` for "/standards/old-style"
- **AND** a destination `MemoryClient` for "/archive/old-style"
- **WHEN** `move(destinationClient)` is called
- **THEN** the memory is moved on disk
- **AND** it returns a new `MemoryClient` for "/archive/old-style"

#### Scenario: Move memory to MemoryPath destination

- **GIVEN** a `MemoryClient` for "/standards/old-style"
- **AND** a `MemoryPath` for "/archive/2024/old-style"
- **WHEN** `move(memoryPath)` is called
- **THEN** the memory is moved on disk
- **AND** it returns a new `MemoryClient` for "/archive/2024/old-style"

#### Scenario: Move preserves source client rawPath

- **GIVEN** a `MemoryClient` source for "/standards/style"
- **WHEN** `move(destination)` is called
- **THEN** the source client's `rawPath` remains "/standards/style"
- **AND** a new client is returned for the destination
