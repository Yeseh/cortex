# CLI Testing Runbook Summary

## Overview

Comprehensive test runbook for the Cortex CLI with 40 test cases covering:

- Basic operations (version, help, init)
- Memory CRUD (add, show, list, update, move, remove)
- Store management (init, list, add, remove, prune, reindex)
- Error handling and edge cases
- Cross-platform path handling
- Performance baseline testing

## Prerequisites

- Bun v1.3.6+ installed
- CLI access via `bun run packages/cli/src/run.ts` or global install

## Quick Start

```bash
# Build and test
cd packages/cli && bun install && bun test

# Run CLI
alias cortex="bun run packages/cli/src/run.ts"
cortex --version
```

## Test Categories

| Category           | Test Cases       | Description                              |
| ------------------ | ---------------- | ---------------------------------------- |
| TC-CLI-001-004     | Basic operations | Version, help, init                      |
| TC-CLI-005-014     | Memory CRUD      | Add, show, list, update with all options |
| TC-CLI-015-018     | Move/Remove      | Relocate and delete memories             |
| TC-CLI-019-028     | Store operations | Multi-store workflows                    |
| TC-CLI-029-030     | Output formats   | JSON, YAML, TOON                         |
| TC-CLI-031         | Citations        | Source tracking                          |
| TC-CLI-032-035     | Error handling   | Invalid paths, dates, stores             |
| TC-CLI-036-040     | Edge cases       | Unicode, large content, concurrency      |
| TC-CLI-INT-001-002 | Integration      | Full workflow scenarios                  |

## Performance Baseline

- 100 memories created: <30 seconds
- List 100 memories: <1 second
- Show single memory: <100ms

## Full Test Details

See external documentation or run test suite at `packages/cli/src/**/*.spec.ts`

## Sign-off Template

- [ ] All test cases pass
- [ ] No crashes or hangs
- [ ] Error messages helpful
- [ ] Performance acceptable
