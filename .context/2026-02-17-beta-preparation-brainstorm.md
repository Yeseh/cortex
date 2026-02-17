# Beta Preparation Brainstorm

**Date:** 2026-02-17
**Purpose:** Identify what's needed beyond open feature work to prepare Cortex for colleague beta testing

## Current State

### Open Feature Changes (7 total, ~140 tasks)

| Change                           | Tasks | Age |
| -------------------------------- | ----- | --- |
| `add-category-hierarchy-config`  | 0/14  | 3m  |
| `add-category-mode-enforcement`  | 0/19  | 3m  |
| `add-cli-category-bootstrapping` | 0/14  | 3m  |
| `add-memory-client`              | 0/29  | 3m  |
| `add-store-client`               | 0/16  | 3m  |
| `add-category-client`            | 0/28  | 3m  |
| `add-sqlite-index`               | 0/22  | 1d  |

### Feature Memories (brainstormed, some have OpenSpec changes)

- **Dashboard UI** - Separate process for viewing/editing memories with access stats
- **SQLite Derived Index** - Replace per-category YAML with SQLite (has OpenSpec)
- **Fluent Client API** - Azure SDK-style hierarchical clients (has OpenSpec)
- **Category Hierarchy Enforcement** - Config-driven category structure (has OpenSpec)

### Health Check

- **Tests:** 757 passing
- **README:** Exists with installation docs
- **npm packages:** Not yet published (installation instructions reference unpublished packages)

---

## Beta Readiness Areas to Explore

### 1. Distribution & Installation

**Current state:**

- README shows `bun add -g @yeseh/cortex-cli` but packages aren't published to npm
- MCP server config shows `cortex-mcp` as a command
- Compiled binary support exists via `compile:mcp` and `compile:cli` scripts

**Questions to resolve:**

- [ ] How will colleagues actually install Cortex?
    - Share compiled binaries directly?
    - Publish to npm (private/beta)?
    - Clone repo and build locally?
- [ ] If binaries: where to host them? GitHub releases?
- [ ] If npm: private registry or public beta?
- [ ] Platform support: Linux only? macOS? Windows?

### 2. First-Run Experience

**Questions to resolve:**

- [ ] Does `cortex init` work smoothly end-to-end?
- [ ] What defaults are created? (global store, config file)
- [ ] Should there be example memories to demonstrate the system?
- [ ] Is the default category structure sensible?
- [ ] What about MCP server setup - is the Claude Desktop config clear?

**Potential improvements:**

- Guided init wizard with prompts
- Example memories in a "getting-started" category
- `cortex doctor` command to verify setup

### 3. Documentation Gaps

**Current state:**

- README covers basic CLI usage
- No dedicated docs/ folder

**Missing for beta testers:**

- [ ] Integration guides for AI tools (Claude Desktop, OpenCode, Cursor, etc.)
- [ ] Troubleshooting guide for common issues
- [ ] Example use cases and category structures
- [ ] Memory content best practices (what makes a good memory?)
- [ ] MCP tool reference with examples

**Format options:**

- Markdown docs in repo
- Simple static site (Vitepress, Docusaurus)
- Just README expansion for now

### 4. Error Messages & Observability

**Questions to resolve:**

- [ ] Are error messages actionable for someone unfamiliar with codebase?
- [ ] Is there a debug/verbose mode?
- [ ] How do users report issues? (error codes, stack traces, logs?)

**Potential improvements:**

- `--verbose` flag for detailed output
- Error codes that can be searched
- `cortex debug` command to dump system state

### 5. Data Safety & Recovery

**Questions to resolve:**

- [ ] What happens if store or config is corrupted?
- [ ] Is there backup/restore mechanism?
- [ ] Can users easily reset to clean state?
- [ ] What about accidental bulk deletes?

**Potential improvements:**

- `cortex backup` / `cortex restore` commands
- Soft delete with trash/undo
- Config validation on load with recovery hints
- Git-based backup (since stores are git-friendly)

### 6. Scope Prioritization

**The big question:** Which of the 7 open changes are essential for beta vs. nice-to-have?

**Analysis by feature:**

| Feature                      | Beta Essential? | Rationale                               |
| ---------------------------- | --------------- | --------------------------------------- |
| Category hierarchy config    | Maybe           | Nice structure, but free mode works     |
| Category mode enforcement    | Maybe           | Protects structure, but adds complexity |
| CLI category bootstrapping   | Maybe           | Convenience for setup                   |
| Memory client (fluent API)   | No              | Nice DX, but current API works          |
| Store client (fluent API)    | No              | Nice DX, but current API works          |
| Category client (fluent API) | No              | Nice DX, but current API works          |
| SQLite index                 | Maybe           | Better querying, but YAML works         |

**Recommendation:** Consider what problems beta testers will actually hit:

1. Installation friction (high impact)
2. Confusion about usage patterns (high impact)
3. Lack of query power (medium impact)
4. API ergonomics (low impact for MCP users)

---

## Discussion Topics

1. **What's the minimum viable distribution?** Binary downloads via GitHub releases?

2. **What feedback are you hoping to gather from beta testers?**
    - Usability issues?
    - Missing features?
    - Performance?
    - Integration pain points?

3. **Which open features would most improve beta tester experience?**

4. **What's the timeline/deadline for beta?**

5. **How many colleagues and what's their context?**
    - AI tool experience level
    - Which AI tools they use (Claude Desktop, OpenCode, etc.)
    - What projects/use cases they'd test with

---

## Next Steps

_To be filled in after discussion_
