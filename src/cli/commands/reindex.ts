/**
 * Reindex command flow for rebuilding category indexes.
 */

import type { Result } from '../../core/types.ts';
import type { StorageAdapterError } from '../../core/storage/adapter.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem/index.ts';

export interface ReindexCommandOptions {
    storeRoot: string;
    args: string[];
}

export interface ReindexCommandOutput {
    message: string;
    warnings: string[];
}

export interface ReindexCommandError {
    code: 'REINDEX_FAILED' | 'INVALID_ARGUMENTS';
    message: string;
    cause?: StorageAdapterError;
    details?: { args: string[] };
}

type ReindexCommandResult = Result<ReindexCommandOutput, ReindexCommandError>;

interface ParsedReindexArgs {
    verbose: boolean;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Parses reindex command arguments.
 *
 * @param args - Command line arguments
 * @returns Parsed arguments or error
 */
const parseReindexArgs = (args: string[]): Result<ParsedReindexArgs, ReindexCommandError> => {
    let verbose = false;

    for (const arg of args) {
        if (arg === '--verbose') {
            verbose = true;
        }
        else {
            return err({
                code: 'INVALID_ARGUMENTS',
                message: `Unexpected arguments for reindex: ${arg}.`,
                details: { args },
            });
        }
    }

    return ok({ verbose });
};

export const runReindexCommand = async (
    options: ReindexCommandOptions,
): Promise<ReindexCommandResult> => {
    const parsed = parseReindexArgs(options.args);
    if (!parsed.ok) {
        return parsed;
    }

    const adapter = new FilesystemStorageAdapter({ rootDirectory: options.storeRoot });
    const reindexResult = await adapter.reindexCategoryIndexes();
    if (!reindexResult.ok) {
        return err({
            code: 'REINDEX_FAILED',
            message: reindexResult.error.message,
            cause: reindexResult.error,
        });
    }

    const warnings = reindexResult.value.warnings;
    let message = `Reindexed category indexes for ${options.storeRoot}.`;

    // Add warning count to message if there are warnings
    if (warnings.length > 0) {
        const plural = warnings.length === 1 ? '' : 's';
        message += ` (${warnings.length} warning${plural})`;
    }

    // Include verbose warning details
    if (parsed.value.verbose && warnings.length > 0) {
        message += '\n\nWarnings:\n' + warnings.map((w) => `  - ${w}`).join('\n');
    }

    return ok({ message, warnings });
};
