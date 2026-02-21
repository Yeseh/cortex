/**
 * Store command group for the Cortex CLI.
 *
 * Provides store management operations including listing, adding, removing,
 * and initializing memory stores. Also includes maintenance commands for
 * pruning expired memories and reindexing stores.
 *
 * The `--store` option is defined at the group level and inherited by all
 * subcommands, allowing users to specify which store to operate on.
 *
 * @example
 * ```bash
 * cortex store list                 # List all registered stores
 * cortex store add <name> <path>    # Register a store
 * cortex store remove <name>        # Unregister a store
 * cortex store init [path]          # Initialize a new store
 * cortex store prune                # Remove expired memories
 * cortex store reindex              # Rebuild store indexes
 * ```
 */
import { Command } from '@commander-js/extra-typings';

import { listCommand } from './commands/list.ts';
import { addCommand } from './commands/add.ts';
import { removeCommand } from './commands/remove.ts';
import { initCommand } from './commands/init.ts';
import { pruneCommand } from './commands/prune.ts';
import { reindexCommand } from './commands/reindexs.ts';
import { throwCoreError } from '../errors.ts';
import { Slug } from '@yeseh/cortex-core';
import { basename } from 'node:path';
import { detectGitRepoName } from '../utils/git.ts';

/**
 * Resolves the store name using a priority-based strategy.
 *
 * Name resolution follows this precedence:
 * 1. **Explicit name** - If `--name` option is provided, use it directly
 * 2. **Git detection** - Auto-detect from git repository directory name
 * 3. **Folder name** - Use the current folder name if git detection fails
 * 4. **Error** - Fail with guidance to use `--name` flag
 *
 * Git repository names are normalized to valid store name format:
 * - Converted to lowercase
 * - Non-alphanumeric characters replaced with hyphens
 * - Leading/trailing hyphens removed
 *
 * @param cwd - Current working directory
 * @param explicitName - Optional explicit name provided via `--name` option
 * @returns The validated store name
 * @throws {InvalidArgumentError} When the name is invalid
 * @throws {CommanderError} When git detection fails and no name provided
 */
export async function resolveStoreName(cwd: string, explicitName?: string): Promise<string> {
    // 1. Use explicit name if provided
    if (explicitName) {
        const slugResult = Slug.from(explicitName);
        if (!slugResult.ok()) {
            throwCoreError({ 
                code: 'INVALID_STORE_NAME', 
                message: 'Store name must be a lowercase slug (letters, numbers, hyphens).' 
            });
        }

        return slugResult.value.toString();
    }

    // 2. Try git detection
    const gitName = await detectGitRepoName(cwd);
    if (gitName) {
        // Convert to valid store name (lowercase slug)
        const normalized = gitName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        const slugResult = Slug.from(normalized);
        if (!slugResult.ok()) {
            throwCoreError({
                code: 'INVALID_STORE_NAME',
                message: 'Could not derive valid store name from git repo.',
            });
        }
        return slugResult.value.toString();
    }

    // 3. Use the leaf folder name if git detection fails
    const folderName = basename(cwd);
    const slugResult = Slug.from(folderName);
    if (slugResult.ok()) {
        return slugResult.value.toString();
    }

    // 4. Error: require --name
    throwCoreError({
        code: 'GIT_REPO_REQUIRED',
        message: 'Not in a git repository. Use --name to specify the store name.',
    });
}


/**
 * Store command group.
 *
 * The `--store` option is inherited by all subcommands, allowing operations
 * to target a specific named store rather than using automatic store resolution.
 */
export const storeCommand = new Command('store')
    .description('Store management')
    .option('-s, --store <name>', 'Use a specific named store');

storeCommand.addCommand(listCommand);
storeCommand.addCommand(addCommand);
storeCommand.addCommand(removeCommand);
storeCommand.addCommand(initCommand);
storeCommand.addCommand(pruneCommand);
storeCommand.addCommand(reindexCommand);

