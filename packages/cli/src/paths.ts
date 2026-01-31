/**
 * Path resolution utilities for CLI commands.
 *
 * Provides cross-platform path handling including:
 * - Home directory (~) expansion
 * - Absolute path detection (Unix, Windows drive, UNC)
 * - Relative path resolution
 */

import { homedir } from 'node:os';
import { resolve } from 'node:path';

/**
 * Checks if a path is absolute.
 * Handles Unix paths, Windows drive paths (C:\), and UNC paths (\\server).
 */
export function isAbsolutePath(inputPath: string): boolean {
    // Unix absolute path
    if (inputPath.startsWith('/')) return true;
    // Windows drive path (e.g., C:\, D:/)
    if (/^[a-zA-Z]:[/\\]/.test(inputPath)) return true;
    // UNC path (e.g., \\server\share, //server/share)
    if (inputPath.startsWith('\\\\') || inputPath.startsWith('//')) return true;
    return false;
}

/**
 * Resolves a user-provided path to an absolute path.
 *
 * Handles:
 * - Home directory expansion (~)
 * - Absolute paths (returned as-is, normalized)
 * - Relative paths (resolved against cwd)
 *
 * @param inputPath - The path to resolve
 * @param cwd - Current working directory for relative path resolution
 * @returns Normalized absolute path
 */
export function resolveUserPath(inputPath: string, cwd: string): string {
    // Expand home directory
    if (inputPath.startsWith('~')) {
        const home = homedir();
        return resolve(home, inputPath.slice(1).replace(/^[/\\]/, ''));
    }
    // Already absolute
    if (isAbsolutePath(inputPath)) {
        return resolve(inputPath);
    }
    // Relative to cwd
    return resolve(cwd, inputPath);
}
