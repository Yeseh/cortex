/**
 * Store resolution for local and global stores.
 */

import { access } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import type { Result } from '../types.ts';
import type { CortexConfig } from '../config.ts';

export interface StoreResolution {
    root: string;
    scope: 'local' | 'global';
}

export type StoreResolutionErrorCode =
    | 'LOCAL_STORE_MISSING'
    | 'GLOBAL_STORE_MISSING'
    | 'STORE_ACCESS_FAILED';

export interface StoreResolutionError {
    code: StoreResolutionErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
}

export interface StoreResolutionOptions {
    cwd?: string;
    globalStorePath: string;
    config?: CortexConfig;
}

type ResolveStoreResult = Result<StoreResolution, StoreResolutionError>;
export type { ResolveStoreResult };

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const resolveCortexDir = (cwd: string): string => resolve(cwd, '.cortex', 'memory');

const isMissingPath = (error: unknown): boolean =>
    !!error && typeof error === 'object' && 'code' in error
        ? (error as { code?: string }).code === 'ENOENT'
        : false;

const canAccess = async (path: string): Promise<Result<boolean, StoreResolutionError>> => {
    try {
        await access(path);
        return ok(true);
    } 
    catch (error) {
        if (isMissingPath(error)) {
            return ok(false);
        }
        return err({
            code: 'STORE_ACCESS_FAILED',
            message: `Failed to access store path: ${path}.`,
            path,
            cause: error,
        });
    }
};

export const resolveStore = async (
    options: StoreResolutionOptions,
): Promise<ResolveStoreResult> => {
    const cwd = options.cwd ?? process.cwd();
    const localPath = resolveCortexDir(cwd);
    const localCheck = await canAccess(localPath);
    if (!localCheck.ok) {
        return localCheck;
    }
    if (localCheck.value) {
        return ok({ root: localPath, scope: 'local' });
    }

    const strictLocal = options.config?.strict_local ?? options.config?.strictLocal ?? false;
    if (strictLocal) {
        return err({
            code: 'LOCAL_STORE_MISSING',
            message: 'Local store not found and strict_local is enabled.',
            path: localPath,
        });
    }

    return resolveGlobalStore(cwd, options.globalStorePath);
};

const resolveGlobalStore = async (
    cwd: string,
    globalStorePath: string,
): Promise<Result<StoreResolution, StoreResolutionError>> => {
    const globalPath = isAbsolute(globalStorePath)
        ? globalStorePath
        : resolve(cwd, globalStorePath);
    const globalCheck = await canAccess(globalPath);
    if (!globalCheck.ok) {
        return globalCheck;
    }
    if (!globalCheck.value) {
        return err({
            code: 'GLOBAL_STORE_MISSING',
            message: 'Global store not found.',
            path: globalPath,
        });
    }

    return ok({ root: globalPath, scope: 'global' });
};
