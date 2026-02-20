/**
 * Store resolution utilities for CLI commands.
 *
 * This module provides functions to resolve the store context (root directory)
 * based on command-line options, current working directory, and the global
 * store registry.
 */

import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import {
    type CortexConfig,
    type Result,
    type CortexContext,
    err,
    ok,
    Cortex,
    type ConfigError,
} from '@yeseh/cortex-core';
import {
    resolveStore,
    type StoreResolutionError,
} from '@yeseh/cortex-core/store';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
import type { StorageAdapter, StoreNotFoundError } from '@yeseh/cortex-core/storage';
import { throwCoreError } from './errors';
import type { StoreResolveError } from '../../core/src/store/result';

/**
 * Result of resolving a store with its adapter.
 */
export interface ResolvedStore {
    /** The resolved store context with path information */
    context: StoreContext;
    /** Scoped storage adapter for store operations */
    adapter: StorageAdapter;
}

/**
 * Resolved store context containing the root path and optional store name.
 */
export interface StoreContext {
    /** The resolved filesystem path to the store root */
    root: string;
    /** The store name if resolved from registry, undefined for local/default stores */
    name?: string;
    /** The scope of the resolved store */
    scope: 'local' | 'global' | 'registry';
}

/**
 * Options for resolving store context.
 */
export interface StoreContextOptions {
    /** Current working directory (defaults to process.cwd()) */
    cwd?: string;
    /** Path to the global store (defaults to ~/.config/cortex/memory) */
    globalStorePath?: string;
    /** Path to the store registry (defaults to ~/.config/cortex/stores.yaml) */
    registryPath?: string;
}

export type StoreContextErrorCode =
    | 'CONFIG_LOAD_FAILED'
    | 'STORE_RESOLUTION_FAILED'
    | 'REGISTRY_LOAD_FAILED'
    | 'STORE_NOT_FOUND';

export interface StoreContextError {
    code: StoreContextErrorCode;
    message: string;
    cause?: StoreResolutionError 
        | ConfigError 
        | StoreResolveError 
        | StoreNotFoundError;
}
/**
 * Default path to the global store.
 */
export const getDefaultGlobalStorePath = (): string =>
    resolve(homedir(), '.config', 'cortex', 'memory');

/**
 * Default path to the store registry.
 */
export const getDefaultRegistryPath = (): string =>
    resolve(homedir(), '.config', 'cortex', 'config.yaml');
