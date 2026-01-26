/**
 * CLI help command for displaying usage information.
 */

import type { Result } from '../../core/types.ts';

export interface HelpCommandOptions {
    args: string[];
}

export interface HelpCommandOutput {
    message: string;
}

export interface HelpCommandError {
    code: 'INVALID_ARGUMENTS';
    message: string;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const VERSION = '0.1.0';

export const MAIN_HELP = `cortex v${VERSION} - Memory system for AI agents

USAGE
  cortex <command> [options]
  cortex <command> --help

COMMANDS
  Setup
    init             Initialize global config store (~/.config/cortex/)

  Memory Operations
    add <path>       Create a new memory
    show <path>      Display memory content
    update <path>    Update an existing memory
    remove <path>    Delete a memory
    move <from> <to> Move or rename a memory
    list [category]  List memories in store

  Store Management
    store list                   List registered stores
    store add <name> <path>      Register a new store
    store remove <name>          Unregister a store
    store init [path]            Initialize a store (default: ./.cortex)

  Maintenance
    reindex          Rebuild store indexes
    prune            Delete expired memories

GLOBAL OPTIONS
  --help                Show help for a command
  --store <name>        Use a specific named store
  --global-store <path> Override the global store path

EXAMPLES
  cortex init
  cortex add project/tech-stack --content "Using TypeScript and Bun"
  cortex show project/tech-stack
  cortex list project
  cortex store init
  cortex prune --store my-store
  cortex add --help

For more information, run: cortex <command> --help
`;

export const COMMAND_HELP: Record<string, string> = {
    init: `cortex init - Initialize global config store

USAGE
  cortex init [options]

DESCRIPTION
  Creates the global configuration at ~/.config/cortex/ with config.yaml
  and stores.yaml, plus a default global store at ~/.config/cortex/memory/
  with two categories: 'global' and 'projects'.

  This command sets up the foundational directory structure needed for cortex
  to store memories globally across all projects.

OPTIONS
  --force, -f     Reinitialize even if already exists (overwrites existing)

STRUCTURE CREATED
  ~/.config/cortex/
  ├── config.yaml           # Global configuration
  ├── stores.yaml           # Store registry
  └── memory/               # Default global store
      ├── index.yaml        # Root category index
      ├── global/
      │   └── index.yaml    # Global category index
      └── projects/
          └── index.yaml    # Projects category index

EXAMPLES
  cortex init
  cortex init --force
`,

    add: `cortex add - Create a new memory

USAGE
  cortex add <path> [options]

ARGUMENTS
  <path>    Memory path (e.g., project/tech-stack, human/preferences)

OPTIONS
  --content <text>      Memory content as inline text
  --file <filepath>     Read content from a file
  --tags <t1,t2,...>    Comma-separated tags
  --expires-at <date>   Expiration date (ISO 8601 format)
  --store <name>        Use a specific named store

INPUT METHODS
  Content can be provided via:
  - Inline text:  cortex add path --content "content here"
  - File:         cortex add path --file ./notes.md
  - Stdin pipe:   echo "content" | cortex add path
  - Stdin:        cortex add path (blocks until EOF)

EXAMPLES
  cortex add project/tech-stack --content "TypeScript + Bun"
  cortex add human/preferences --file ./prefs.md --tags config,user
  cat notes.md | cortex add domain/architecture
  cortex add project/deadline --content "Q2 2026" --expires-at 2026-07-01
`,

    show: `cortex show - Display memory content

USAGE
  cortex show <path> [options]

ARGUMENTS
  <path>    Memory path to display

OPTIONS
  --store <name>        Use a specific named store
  --include-expired     Show memory even if expired

EXAMPLES
  cortex show project/tech-stack
  cortex show human/preferences --store work
`,

    update: `cortex update - Update an existing memory

USAGE
  cortex update <path> [options]

ARGUMENTS
  <path>    Memory path to update

OPTIONS
  --content <text>      Replace content with inline text
  --file <filepath>     Replace content from file
  --tags <t1,t2,...>    Replace tags (comma-separated)
  --expires-at <date>   Set or update expiration date
  --clear-expiry        Remove expiration date
  --store <name>        Use a specific named store

NOTES
  - Multiple flags can be combined
  - Content can also be piped via stdin
  - Only specified fields are updated

EXAMPLES
  cortex update project/tech-stack --content "Now using Deno"
  cortex update project/deadline --expires-at 2026-12-31
  cortex update human/preferences --tags updated,config --clear-expiry
`,

    remove: `cortex remove - Delete a memory

USAGE
  cortex remove <path> [options]

ARGUMENTS
  <path>    Memory path to delete

OPTIONS
  --store <name>        Use a specific named store

EXAMPLES
  cortex remove project/old-notes
  cortex remove human/temp --store scratch
`,

    move: `cortex move - Move or rename a memory

USAGE
  cortex move <from> <to> [options]

ARGUMENTS
  <from>    Source memory path
  <to>      Destination memory path

OPTIONS
  --store <name>        Use a specific named store

EXAMPLES
  cortex move project/notes project/archived-notes
  cortex move human/temp human/preferences
`,

    list: `cortex list - List memories in store

USAGE
  cortex list [category] [options]

ARGUMENTS
  [category]    Optional category to filter (e.g., project, human)

OPTIONS
  --include-expired     Include expired memories in listing
  --format <fmt>        Output format: yaml (default) or json
  --store <name>        Use a specific named store

EXAMPLES
  cortex list
  cortex list project
  cortex list --include-expired --format json
`,

    store: `cortex store - Manage named stores

USAGE
  cortex store <subcommand> [options]

SUBCOMMANDS
  list                   List all registered stores
  add <name> <path>      Register a new named store
  remove <name>          Unregister a store (does not delete files)
  init [path]            Initialize a new store at path (default: ./.cortex)

EXAMPLES
  cortex store list
  cortex store add work ~/work/.cortex
  cortex store add company-standards /shared/standards/.cortex
  cortex store remove work
  cortex store init
  cortex store init ./my-memories
`,

    reindex: `cortex reindex - Rebuild store indexes

USAGE
  cortex reindex [options]

OPTIONS
  --store <name>        Use a specific named store

DESCRIPTION
  Rebuilds all index.yaml files in the store by scanning the filesystem.
  Use this to repair corrupted or out-of-sync indexes.

EXAMPLES
  cortex reindex
  cortex reindex --store company-standards
`,

    prune: `cortex prune - Delete expired memories

USAGE
  cortex prune [options]

OPTIONS
  --store <name>        Use a specific named store

DESCRIPTION
  Permanently deletes all memories that have passed their expires_at date.
  This operation cannot be undone.

EXAMPLES
  cortex prune
  cortex prune --store scratch
`,
};

const parseHelpArgs = (args: string[]): Result<{ command?: string }, HelpCommandError> => {
    const positional: string[] = [];

    for (const arg of args) {
        if (!arg) {
            continue;
        }
        if (arg.startsWith('-')) {
            return err({
                code: 'INVALID_ARGUMENTS',
                message: `Unknown flag: ${arg}.`,
            });
        }
        positional.push(arg);
    }

    if (positional.length > 1) {
        return err({
            code: 'INVALID_ARGUMENTS',
            message: 'Too many arguments for help command.',
        });
    }

    return ok({ command: positional[ 0 ] });
};

export const runHelpCommand = (
    options: HelpCommandOptions,
): Result<HelpCommandOutput, HelpCommandError> => {
    const parsed = parseHelpArgs(options.args);
    if (!parsed.ok) {
        return parsed;
    }

    const command = parsed.value.command;
    if (!command) {
        return ok({ message: MAIN_HELP });
    }

    const commandHelp = COMMAND_HELP[ command ];
    if (!commandHelp) {
        return err({
            code: 'INVALID_ARGUMENTS',
            message: `Unknown command: ${command}. Run 'cortex help' for available commands.`,
        });
    }

    return ok({ message: commandHelp });
};
