/**
 * Store resolution utilities for CLI commands.
 *
 * This module provides functions to resolve the store context (root directory)
 * based on command-line options, current working directory, and the global
 * store configuration.
 */

import { homedir } from 'node:os';
import { resolve } from 'node:path';

/**
 * Default path to the global store.
 */
export const getDefaultGlobalStorePath = (): string =>
    resolve(homedir(), '.config', 'cortex', 'memory');

/**
 * Default path to the store configuration file.
 * Respects CORTEX_CONFIG (config file path) and CORTEX_CONFIG_DIR (config directory)
 * environment variables when set.
 */
export const getDefaultConfigPath = (): string => {
    const envConfigPath = process.env.CORTEX_CONFIG;
    if (envConfigPath) {
        return resolve(envConfigPath);
    }

    const envConfigDir = process.env.CORTEX_CONFIG_DIR;
    if (envConfigDir) {
        return resolve(envConfigDir, 'config.yaml');
    }
    return resolve(homedir(), '.config', 'cortex', 'config.yaml');
};
