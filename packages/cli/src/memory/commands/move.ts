/**
 * Memory move command implementation using Commander.js.
 *
 * Moves a memory from one path to another within the same store.
 *
 * @example
 * ```bash
 * # Move a memory to a new location
 * cortex memory move project/old-name project/new-name
 *
 * # Move with explicit store
 * cortex memory --store my-store move project/old project/new
 * ```\n */

import { Command } from '@commander-js/extra-typings';
import { throwCliError } from '../../errors.ts';
import { MemoryPath, type CortexContext } from '@yeseh/cortex-core';
import { createCliCommandContext } from '../../create-cli-command.ts';
import { serializeOutput, type OutputFormat } from '../../output.ts';

/** Options for the move command. */
export interface MoveCommandOptions {
    /** Output format (yaml, json, toon) */
    format?: string;
}

/**
 * Handler for the memory move command.
 * Exported for direct testing without Commander parsing.
 *
 * @param ctx - CLI context containing Cortex client and streams
 * @param storeName - Optional store name from parent command
 * @param from - Source memory path
 * @param to - Destination memory path
 */
export async function handleMove(
    ctx: CortexContext,
    storeName: string | undefined,
    from: string,
    to: string,
    options: MoveCommandOptions = {}
): Promise<void> {
    const fromResult = MemoryPath.fromString(from);
    if (!fromResult.ok()) {
        throwCliError(fromResult.error);
    }

    const toResult = MemoryPath.fromString(to);
    if (!toResult.ok()) {
        throwCliError(toResult.error);
    }

    const storeResult = ctx.cortex.getStore(storeName ?? 'global');
    if (!storeResult.ok()) {
        throwCliError(storeResult.error);
    }

    const store = storeResult.value;
    const rootResult = store.root();
    if (!rootResult.ok()) {
        throwCliError(rootResult.error);
    }

    const sourceCategoryResult = fromResult.value.category.isRoot
        ? rootResult
        : rootResult.value.getCategory(fromResult.value.category.toString());
    if (!sourceCategoryResult.ok()) {
        throwCliError(sourceCategoryResult.error);
    }

    const sourceMemory = sourceCategoryResult.value.getMemory(fromResult.value.slug.toString());
    const moveResult = await sourceMemory.move(toResult.value);
    if (!moveResult.ok()) {
        throwCliError(moveResult.error);
    }

    const out = ctx.stdout ?? process.stdout;
    const rawFormat = options.format;
    if (!rawFormat) {
        out.write(`Moved memory ${fromResult.value.toString()} to ${toResult.value.toString()}.\n`);
    } else {
        const format = rawFormat as OutputFormat;
        const serialized = serializeOutput(
            { from: fromResult.value.toString(), to: toResult.value.toString() },
            format
        );
        if (!serialized.ok()) {
            throwCliError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
        }
        out.write(serialized.value + '\n');
    }
}

/**
 * The `memory move` subcommand.
 *
 * Moves a memory from one path to another within the store.
 * Both paths must be valid memory slug paths.
 *
 * The `--store` option is inherited from the parent `memory` command.
 */
export const moveCommand = new Command('move')
    .description('Move a memory to a new path')
    .argument('<from>', 'Source memory path')
    .argument('<to>', 'Destination memory path')
    .option('-o, --format <format>', 'Output format (yaml, json, toon)')
    .action(async (from, to, options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCliError(context.error);
        }

        await handleMove(context.value, parentOpts?.store, from, to, options);
    });
