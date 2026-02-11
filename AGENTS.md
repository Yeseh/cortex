# Cortex

## Project information
Repository: https://github.com/yeseh/cortex
Use the `gh` CLI tool to interact with the repository, issues, pull requests, and cicd workflows. 

## Using memory

When interacting with the memory system use `cortex` as the project store 

### Categories of note
- `default:human/identity`: Use this category to store user identity information
- `default:human/coding-preferences`: Use this category to store user coding preferences
- `cortex:standards`: Use this category for architectural decisions 
- `cortex:decisions`: Use this category for recording specific decisions made during development

## Rules

- Preexisting failing tests should be fixed before implementing new features. If a test is failing, it indicates a problem that needs to be addressed before moving forward.

## Conventional commit
When writing conventional commits use the following areas:

- `core`: For changes related to the core functionality of the project
- `mcp`: For changes related to the MCP server
- `cli`: For changes related to the command-line interface 
- `storage-fs`: For changes related to the filesystem storage adapter

Example commit message: `feat(core): add new caching mechanism for improved performance`

<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->
