/**
 * Memory file operations for filesystem storage.
 *
 * Handles reading, writing, moving, and removing memory files
 * from the filesystem.
 *
 * @module core/storage/filesystem/files
 */

import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { MemoryIdentity, MemorySlugPath, Result } from '../../types.ts';
import type { StorageAdapterError } from '../adapter.ts';
import { validateMemorySlugPath } from '../../memory/validation.ts';
import type { FilesystemContext, StringOrNullResult } from './types.ts';
import { err, isNotFoundError, ok, resolveStoragePath } from './utils.ts';

/**
 * Validates a slug path and returns the memory identity.
 * Prevents 'index' as a slug to avoid collision with index files.
 */
export const validateSlugPath = (
    slugPath: string,
    failure: { code: StorageAdapterError['code']; message: string; path: string },
): Result<MemoryIdentity, StorageAdapterError> => {
    const identity = validateMemorySlugPath(slugPath);
    if (!identity.ok) {
        return err({ ...failure, cause: identity.error });
    }
    // Prevent 'index' as memory slug to avoid collision with index files
    if (identity.value.slug === 'index') {
        return err({
            ...failure,
            message: 'Memory slug "index" is reserved for index files.',
        });
    }
    return ok(identity.value);
};

/**
 * Resolves the filesystem path for a memory file.
 */
export const resolveMemoryPath = (
    ctx: FilesystemContext,
    slugPath: MemorySlugPath,
    errorCode: StorageAdapterError['code'],
): Result<string, StorageAdapterError> => {
    return resolveStoragePath(ctx.storeRoot, `${slugPath}${ctx.memoryExtension}`, errorCode);
};

/**
 * Reads a memory file from the filesystem.
 *
 * @param ctx - Filesystem context with configuration
 * @param slugPath - Path to the memory (e.g., "project/cortex/config")
 * @returns The file contents or null if not found
 */
export const readMemoryFile = async (
    ctx: FilesystemContext,
    slugPath: MemorySlugPath,
): Promise<StringOrNullResult> => {
    const filePathResult = resolveMemoryPath(ctx, slugPath, 'READ_FAILED');
    if (!filePathResult.ok) {
        return filePathResult;
    }
    const filePath = filePathResult.value;
    try {
        const contents = await readFile(filePath, 'utf8');
        return ok(contents);
    }
    catch (error) {
        if (isNotFoundError(error)) {
            return ok(null);
        }
        return err({
            code: 'READ_FAILED',
            message: `Failed to read memory file at ${filePath}.`,
            path: filePath,
            cause: error,
        });
    }
};

/**
 * Writes a memory file to the filesystem.
 *
 * Creates parent directories if they don't exist.
 *
 * @param ctx - Filesystem context with configuration
 * @param slugPath - Path to the memory (e.g., "project/cortex/config")
 * @param contents - The content to write
 * @returns Success or error
 */
export const writeMemoryFile = async (
    ctx: FilesystemContext,
    slugPath: MemorySlugPath,
    contents: string,
): Promise<Result<void, StorageAdapterError>> => {
    const identityResult = validateSlugPath(slugPath, {
        code: 'WRITE_FAILED',
        message: 'Invalid memory slug path.',
        path: slugPath,
    });
    if (!identityResult.ok) {
        return identityResult;
    }

    const filePathResult = resolveMemoryPath(ctx, slugPath, 'WRITE_FAILED');
    if (!filePathResult.ok) {
        return filePathResult;
    }
    const filePath = filePathResult.value;

    try {
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, contents, 'utf8');
    }
    catch (error) {
        return err({
            code: 'WRITE_FAILED',
            message: `Failed to write memory file at ${filePath}.`,
            path: filePath,
            cause: error,
        });
    }

    return ok(undefined);
};

/**
 * Removes a memory file from the filesystem.
 *
 * @param ctx - Filesystem context with configuration
 * @param slugPath - Path to the memory to remove
 * @returns Success or error (returns success if file doesn't exist)
 */
export const removeMemoryFile = async (
    ctx: FilesystemContext,
    slugPath: MemorySlugPath,
): Promise<Result<void, StorageAdapterError>> => {
    const identityResult = validateSlugPath(slugPath, {
        code: 'WRITE_FAILED',
        message: 'Invalid memory slug path.',
        path: slugPath,
    });
    if (!identityResult.ok) {
        return identityResult;
    }

    const filePathResult = resolveMemoryPath(ctx, slugPath, 'WRITE_FAILED');
    if (!filePathResult.ok) {
        return filePathResult;
    }
    const filePath = filePathResult.value;
    try {
        await rm(filePath);
        return ok(undefined);
    }
    catch (error) {
        if (isNotFoundError(error)) {
            return ok(undefined);
        }
        return err({
            code: 'WRITE_FAILED',
            message: `Failed to remove memory file at ${filePath}.`,
            path: filePath,
            cause: error,
        });
    }
};

/**
 * Moves a memory file from one location to another.
 *
 * The destination category must already exist.
 *
 * @param ctx - Filesystem context with configuration
 * @param sourceSlugPath - Source path of the memory
 * @param destinationSlugPath - Destination path for the memory
 * @returns Success or error
 */
export const moveMemoryFile = async (
    ctx: FilesystemContext,
    sourceSlugPath: MemorySlugPath,
    destinationSlugPath: MemorySlugPath,
): Promise<Result<void, StorageAdapterError>> => {
    const sourceIdentityResult = validateSlugPath(sourceSlugPath, {
        code: 'WRITE_FAILED',
        message: 'Invalid source memory slug path.',
        path: sourceSlugPath,
    });
    if (!sourceIdentityResult.ok) {
        return sourceIdentityResult;
    }

    const destinationIdentityResult = validateSlugPath(destinationSlugPath, {
        code: 'WRITE_FAILED',
        message: 'Invalid destination memory slug path.',
        path: destinationSlugPath,
    });
    if (!destinationIdentityResult.ok) {
        return destinationIdentityResult;
    }

    const sourcePathResult = resolveMemoryPath(ctx, sourceSlugPath, 'WRITE_FAILED');
    if (!sourcePathResult.ok) {
        return sourcePathResult;
    }
    const destinationPathResult = resolveMemoryPath(ctx, destinationSlugPath, 'WRITE_FAILED');
    if (!destinationPathResult.ok) {
        return destinationPathResult;
    }
    const destinationDirectory = dirname(destinationPathResult.value);
    try {
        await access(destinationDirectory);
    }
    catch (error) {
        return err({
            code: 'WRITE_FAILED',
            message: `Destination category does not exist for ${destinationSlugPath}.`,
            path: destinationDirectory,
            cause: error,
        });
    }
    try {
        await rename(sourcePathResult.value, destinationPathResult.value);
        return ok(undefined);
    }
    catch (error) {
        return err({
            code: 'WRITE_FAILED',
            message: `Failed to move memory from ${sourceSlugPath} to ${destinationSlugPath}.`,
            path: destinationPathResult.value,
            cause: error,
        });
    }
};
