/**
 * Shared utility functions for filesystem storage operations.
 *
 * @module core/storage/filesystem/utils
 */

import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { err, ok, type Result } from '@yeseh/cortex-core';
import type { StorageAdapterError } from '@yeseh/cortex-core/storage';

/**
 * Checks if an error is a "not found" filesystem error.
 */
export const isNotFoundError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object' || !('code' in error)) {
        return false;
    }
    return (error as { code?: string }).code === 'ENOENT';
};

/**
 * Normalizes a file extension, ensuring it has a leading dot.
 */
export const normalizeExtension = (value: string | undefined, fallback: string): string => {
    const raw = value?.trim();
    if (!raw) {
        return fallback;
    }
    return raw.startsWith('.') ? raw : `.${raw}`;
};

/**
 * Resolves a storage path while preventing path traversal attacks.
 *
 * @param root - The storage root directory
 * @param relativePath - The relative path to resolve
 * @param errorCode - The error code to use if validation fails
 * @returns The resolved absolute path or an error
 */
export const resolveStoragePath = (
    root: string,
    relativePath: string,
    errorCode: StorageAdapterError['code']
): Result<string, StorageAdapterError> => {
    const resolved = resolve(root, relativePath);
    const rootRelative = relative(root, resolved);
    if (rootRelative.startsWith('..') || isAbsolute(rootRelative)) {
        return err({
            code: errorCode,
            message: `Path escapes storage root: ${relativePath}.`,
            path: resolved,
        });
    }

    return ok(resolved);
};

/**
 * Converts a relative file path to a slug path.
 *
 * @param relativePath - Path relative to the storage root
 * @param extension - The file extension to strip
 * @returns The slug path or null if invalid
 */
export const toSlugPathFromRelative = (relativePath: string, extension: string): string | null => {
    if (!relativePath || relativePath.startsWith('..')) {
        return null;
    }
    if (extname(relativePath) !== extension) {
        return null;
    }
    const withoutExtension = relativePath.slice(0, -extension.length);
    const slugPath = withoutExtension
        .split(sep)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0)
        .join('/');
    return slugPath.length > 0 ? slugPath : null;
};
