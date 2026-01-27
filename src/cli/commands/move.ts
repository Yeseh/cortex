/**
 * CLI move command for relocating memories to a new path.
 */

import type { Result } from '../../core/types.ts';
import { validateMemorySlugPath } from '../../core/memory/validation.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem/index.ts';

export interface MoveCommandOptions {
    storeRoot: string;
    args: string[];
}

export interface MoveCommandOutput {
    message: string;
}

export interface MoveCommandError {
    code: 'INVALID_ARGUMENTS' | 'INVALID_SOURCE_PATH' | 'INVALID_DESTINATION_PATH' | 'MOVE_FAILED';
    message: string;
    cause?: unknown;
}

type MoveCommandResult = Result<MoveCommandOutput, MoveCommandError>;

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

interface ParsedMoveArgs {
    sourcePath: string;
    destinationPath: string;
}

const parseMoveArgs = (args: string[]): Result<ParsedMoveArgs, MoveCommandError> => {
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

    if (positional.length === 0) {
        return err({
            code: 'INVALID_ARGUMENTS',
            message: 'Source and destination paths are required for move command.',
        });
    }

    if (positional.length === 1) {
        return err({
            code: 'INVALID_ARGUMENTS',
            message: 'Destination path is required for move command.',
        });
    }

    if (positional.length > 2) {
        return err({
            code: 'INVALID_ARGUMENTS',
            message: 'Too many arguments for move command.',
        });
    }

    return ok({
        sourcePath: positional[0]!,
        destinationPath: positional[1]!,
    });
};

export const runMoveCommand = async (options: MoveCommandOptions): Promise<MoveCommandResult> => {
    const parsed = parseMoveArgs(options.args);
    if (!parsed.ok) {
        return parsed;
    }

    const sourceIdentity = validateMemorySlugPath(parsed.value.sourcePath);
    if (!sourceIdentity.ok) {
        return err({
            code: 'INVALID_SOURCE_PATH',
            message: sourceIdentity.error.message,
            cause: sourceIdentity.error,
        });
    }

    const destinationIdentity = validateMemorySlugPath(parsed.value.destinationPath);
    if (!destinationIdentity.ok) {
        return err({
            code: 'INVALID_DESTINATION_PATH',
            message: destinationIdentity.error.message,
            cause: destinationIdentity.error,
        });
    }

    const adapter = new FilesystemStorageAdapter({ rootDirectory: options.storeRoot });
    const moveResult = await adapter.moveMemoryFile(
        sourceIdentity.value.slugPath,
        destinationIdentity.value.slugPath
    );

    if (!moveResult.ok) {
        return err({
            code: 'MOVE_FAILED',
            message: moveResult.error.message,
            cause: moveResult.error,
        });
    }

    return ok({
        message: `Moved memory from ${sourceIdentity.value.slugPath} to ${destinationIdentity.value.slugPath}.`,
    });
};
