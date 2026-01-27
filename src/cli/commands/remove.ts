/**
 * CLI remove command for deleting a memory by slug path.
 */

import type { Result } from '../../core/types.ts';
import { validateMemorySlugPath } from '../../core/memory/validation.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem/index.ts';

export interface RemoveCommandOptions {
    storeRoot: string;
    args: string[];
}

export interface RemoveCommandOutput {
    message: string;
}

export interface RemoveCommandError {
    code: 'INVALID_ARGUMENTS' | 'INVALID_PATH' | 'REMOVE_FAILED';
    message: string;
    cause?: unknown;
}

type RemoveCommandResult = Result<RemoveCommandOutput, RemoveCommandError>;

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

interface ParsedRemoveArgs {
    slugPath: string;
}

const parseRemoveArgs = (args: string[]): Result<ParsedRemoveArgs, RemoveCommandError> => {
    let slugPath = '';

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
        if (!slugPath) {
            slugPath = arg;
            continue;
        }
        return err({
            code: 'INVALID_ARGUMENTS',
            message: 'Too many arguments for remove command.',
        });
    }

    if (!slugPath) {
        return err({
            code: 'INVALID_ARGUMENTS',
            message: 'Memory path is required for remove command.',
        });
    }

    return ok({ slugPath });
};

export const runRemoveCommand = async (
    options: RemoveCommandOptions
): Promise<RemoveCommandResult> => {
    const parsed = parseRemoveArgs(options.args);
    if (!parsed.ok) {
        return parsed;
    }

    const identity = validateMemorySlugPath(parsed.value.slugPath);
    if (!identity.ok) {
        return err({
            code: 'INVALID_PATH',
            message: identity.error.message,
            cause: identity.error,
        });
    }

    const adapter = new FilesystemStorageAdapter({ rootDirectory: options.storeRoot });
    const removeResult = await adapter.removeMemoryFile(identity.value.slugPath);
    if (!removeResult.ok) {
        return err({
            code: 'REMOVE_FAILED',
            message: removeResult.error.message,
            cause: removeResult.error,
        });
    }

    return ok({
        message: `Removed memory at ${identity.value.slugPath}.`,
    });
};
