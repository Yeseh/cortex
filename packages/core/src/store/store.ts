/**
 * Store resolution for local and global stores.
 */

import { access } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { ok } from '@/result.ts';
import type { CortexConfig } from '../config/config.ts';
import { storeError, type StoreResult, type StoreResolutionError } from './result.ts';

export interface StoreResolution {
    root: string;
    scope: 'local' | 'global';
}

export type { StoreResolutionErrorCode, StoreResolutionError } from './result.ts';

export interface StoreResolutionOptions {
    cwd?: string;
    globalStorePath: string;
    config?: CortexConfig;
}

type ResolveStoreResult = StoreResult<StoreResolution, StoreResolutionError>;
export type { ResolveStoreResult };

const resolveCortexDir = (cwd: string): string => resolve(cwd, '.cortex', 'memory');

const isMissingPath = (error: unknown): boolean =>
    !!error && typeof error === 'object' && 'code' in error
        ? (error as { code?: string }).code === 'ENOENT'
        : false;

const canAccess = async (path: string): Promise<StoreResult<boolean, StoreResolutionError>> => {
    try {
        await access(path);
        return ok(true);
    }
    catch (error) {
        if (isMissingPath(error)) {
            return ok(false);
        }
        return storeError('STORE_ACCESS_FAILED', `Failed to access store path: ${path}.`, {
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
    if (!localCheck.ok()) {
        return localCheck;
    }
    if (localCheck.value) {
        return ok({ root: localPath, scope: 'local' });
    }

    const strictLocal = options.config?.strictLocal ?? false;
    if (strictLocal) {
        return storeError(
            'LOCAL_STORE_MISSING',
            'Local store not found and strictLocal is enabled.',
            { path: localPath },
        );
    }

    return resolveGlobalStore(cwd, options.globalStorePath);
};

const resolveGlobalStore = async (
    cwd: string,
    globalStorePath: string,
): Promise<StoreResult<StoreResolution, StoreResolutionError>> => {
    const globalPath = isAbsolute(globalStorePath)
        ? globalStorePath
        : resolve(cwd, globalStorePath);
    const globalCheck = await canAccess(globalPath);
    if (!globalCheck.ok()) {
        return globalCheck;
    }
    if (!globalCheck.value) {
        return storeError('GLOBAL_STORE_MISSING', 'Global store not found.', {
            path: globalPath,
        });
    }

    return ok({ root: globalPath, scope: 'global' });
};
