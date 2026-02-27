/**
 * Category create command.
 *
 * Creates a category at the specified path, including any missing ancestors.
 *
 * @example
 * ```bash
 * # Create a category in default store
 * cortex category create standards/typescript
 *
 * # Create a category in a specific store
 * cortex category --store my-store create standards/typescript
 *
 * # Serialize output as JSON
 * cortex category create standards --format json
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { type CortexContext } from '@yeseh/cortex-core';

import { createCliCommandContext } from '../../create-cli-command.ts';
import { throwCliError } from '../../errors.ts';
import { serializeOutput, type OutputFormat } from '../../output.ts';

/** Options parsed by Commander for the create command */
export interface CreateCommandOptions {
    description?: string;
    format?: string;
}

/**
 * Handler for the category create command.
 * Exported for direct testing without Commander parsing.
 *
 * @param ctx - CLI execution context
 * @param storeName - Optional store name from parent command
 * @param path - Category path (e.g., "standards/typescript")
 * @param options - Command options from Commander
 */
export async function handleCreate(
    ctx: CortexContext,
    storeName: string | undefined,
    path: string,
    options: CreateCommandOptions = {},
): Promise<void> {
    const storeResult = ctx.cortex.getStore(storeName ?? 'default');
    if (!storeResult.ok()) {
        throwCliError(storeResult.error);
    }

    const rootResult = storeResult.value.root();
    if (!rootResult.ok()) {
        throwCliError(rootResult.error);
    }

    const categoryClient = rootResult.value.getCategory(path);
    if (!categoryClient.ok()) {
        throwCliError(categoryClient.error);
    }

    const result = await categoryClient.value.create();
    if (!result.ok()) {
        throwCliError(result.error);
    }

    const { path: createdPath, created } = result.value;
    const out = ctx.stdout ?? process.stdout;

    const rawFormat = options.format;
    if (!rawFormat) {
        const verb = created ? 'Created' : 'Category already exists:';
        out.write(`${verb} ${createdPath}\n`);
    }
    else {
        const serialized = serializeOutput(
            { path: createdPath, created },
            rawFormat as OutputFormat,
        );
        if (!serialized.ok()) {
            throwCliError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
        }
        out.write(serialized.value + '\n');
    }
}

/**
 * The `category create` subcommand.
 *
 * Creates a category and any missing ancestors.
 */
export const createCommand = new Command('create')
    .description('Create a category (and any missing ancestors)')
    .argument('<path>', 'Category path (e.g., standards/typescript)')
    .option('-d, --description <text>', 'Optional description for the category')
    .option('-o, --format <format>', 'Output format (yaml, json, toon)')
    .action(async (path, options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCliError(context.error);
        }

        await handleCreate(context.value, parentOpts?.store, path, options);
    });
