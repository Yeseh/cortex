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
import { type CortexContext, type Result } from '@yeseh/cortex-core';

import { createCliCommandContext } from '../../create-cli-command.ts';
import { throwCliError } from '../../errors.ts';
import { serializeOutput, type OutputFormat } from '../../output.ts';

/** Options parsed by Commander for the create command */
export interface CreateCommandOptions {
    description?: string;
    format?: string;
}

/**
 * Writes command output to stdout.
 *
 * @param payload - Category creation result payload
 * @param options - Command options
 * @param stdout - Output stream
 */
function writeCreateOutput(
    payload: { path: string; created: boolean },
    options: CreateCommandOptions,
    stdout: NodeJS.WritableStream,
): void {
    const rawFormat = options.format;

    if (!rawFormat) {
        const verb = payload.created ? 'Created' : 'Category already exists:';
        stdout.write(`${verb} ${payload.path}\n`);
        return;
    }

    const serialized = serializeOutput(payload, rawFormat as OutputFormat);
    if (!serialized.ok()) {
        throwCliError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }
    stdout.write(serialized.value + '\n');
}

/**
 * Unwrap a Result and throw a mapped CLI error on failure.
 *
 * @param result - Result value
 * @returns Unwrapped value
 */
function unwrapOrThrow<T, E extends { code: string; message: string }>(result: Result<T, E>): T {
    if (!result.ok()) {
        throwCliError(result.error);
    }

    return result.value;
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
    options: CreateCommandOptions = {}
): Promise<void> {
    const store = unwrapOrThrow(ctx.cortex.getStore(storeName ?? 'global'));
    const root = unwrapOrThrow(store.root());
    const category = unwrapOrThrow(root.getCategory(path));
    const result = unwrapOrThrow(await category.create());

    const out = ctx.stdout ?? process.stdout;
    writeCreateOutput(result, options, out);
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
