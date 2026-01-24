# Project Context

## Purpose

Cortex is a comprehensive memory management system for AI agents. It provides persistent, queryable memory capabilities that enable agents to maintain context across sessions, learn from interactions, and recall relevant information through semantic search.

### Goals
- Provide a unified API for multiple memory types (working, episodic, semantic, procedural)
- Enable semantic search via vector embeddings for contextually relevant recall
- Create library that can be used both as a standalone module and integrated into larger agent frameworks 
- Maintain high performance with configurable storage backends
- Offer a clean, type-safe TypeScript API

## Tech Stack

- **Runtime**: Bun v1.3.6+
- **Language**: TypeScript 5.x (strict mode)
- **Module System**: ESM (ES Modules)
- **Storage Backends**:
  - SQLite (default, embedded) - for local/single-agent deployments
  - PostgreSQL + pgvector (optional) - for scalable deployments with vector search
  - Redis (optional) - for caching and ephemeral memory
- **Testing**: Bun test runner
- **Build**: Bun bundler

## Project Conventions

### Code Style

- Use TypeScript strict mode with all strict flags enabled
- Prefer `const` over `let`; avoid `var`
- Use explicit return types for public functions
- Use PascalCase for types/interfaces/classes, camelCase for variables/functions
- Use kebab-case for file names (e.g., `memory-store.ts`)
- Prefix interfaces with behavior over naming (e.g., `Queryable`, `Persistable` not `IMemory`)
- Use barrel exports (`index.ts`) for public module APIs
- Maximum line length: 100 characters
- Use template literals over string concatenation

### Architecture Patterns

- **Layered Architecture**:
  - `core/` - Core domain models and interfaces
  - `storage/` - Storage adapters (SQLite, PostgreSQL, Redis)
    - `sqlite/` - SQLite adapter implementation
  - `memory/` - Memory type implementations (working, episodic, semantic, procedural)
  - `api/` - Public API surface (library exports)
  - `server/` - Optional HTTP/gRPC service layer
  - `utils/` - Shared utilities

- **Design Principles**:
  - Dependency injection for storage backends
  - Interface-driven design for extensibility
  - Immutable data structures where practical
  - Async-first APIs (all I/O operations return Promises)
  - Treat errors as first-class citizens (use `Result` types) 

- **Memory Types**:
  - **Working Memory**: Session-scoped, conversation context with automatic cleanup
  - **Episodic Memory**: Persistent event/interaction storage with timestamps
  - **Semantic Memory**: Vector-indexed facts and knowledge for similarity search
  - **Procedural Memory**: Learned patterns, skills, and behavioral preferences

### Testing Strategy

- Use Bun's built-in test runner (`bun test`)
- Test files colocated with source: `*.test.ts`
- Unit tests for all public APIs
- Integration tests for storage adapters
- Use in-memory SQLite for fast test execution
- Aim for >80% code coverage on core modules
- Mock external services (embedding APIs, external DBs) in unit tests

### Git Workflow

- **Branch naming**: `feature/`, `fix/`, `refactor/`, `docs/` prefixes
- **Commit messages**: Conventional Commits format
  - `feat:` new features
  - `fix:` bug fixes
  - `refactor:` code restructuring
  - `test:` test additions/changes
  - `docs:` documentation
  - `chore:` maintenance tasks
- **PR requirements**: Tests pass, no type errors, meaningful description
- Main branch is `main`, always deployable

## Domain Context

### Memory System Concepts

- **Memory**: Atomic unit of stored information with metadata (timestamp, source, tags)
- **Memory Block**: Scoped container for related memories (per-agent, per-session, per-topic)
- **Embedding**: Vector representation of text for semantic similarity search
- **Recall**: Process of retrieving relevant memories based on query
- **Consolidation**: Background process for optimizing/summarizing memories
- **Decay**: Optional time-based relevance reduction for memories
- **Session**: Chronological interaction log between agent and environment/user 
- **Progressive Disclosure**: Gradual revelation of memories based on context and relevance

### Integration Points

- Designed to integrate with agent frameworks (LangChain, AutoGPT, custom agents)
- Embedding generation can use OpenAI, local models, or custom providers
- Storage is abstracted to support different backends without API changes

## Important Constraints

- **No runtime dependencies on Node.js APIs** - use Bun-native APIs
- **Minimal external dependencies** - prefer built-in Bun features
- **Backward compatible storage** - migrations must preserve existing data
- **Thread-safe** - storage operations must handle concurrent access
- **Memory efficient** - streaming for large result sets, pagination support
- **Configurable embedding dimensions** - support various embedding models (384, 768, 1536 dimensions)

## External Dependencies

- **Embedding Providers** (optional, for semantic memory):
  - OpenAI Embeddings API
  - Local embedding models via Ollama
  - Custom embedding adapters

- **Database Drivers**:
  - `bun:sqlite` (built-in)
  - `postgres` (npm package, optional)
  - `ioredis` (npm package, optional)

- **Optional Services**:
  - Vector search services (Pinecone, Qdrant) as alternative to pgvector
