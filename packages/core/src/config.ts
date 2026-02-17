/**
 * Configuration definitions for store resolution and output defaults.
 */

import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { type Result, ok, err } from './result.ts';
import type { StoreRegistry } from './store/registry.ts';

export type OutputFormat = 'yaml' | 'json' | 'toon';

/**
 * Expand tilde (~) to the user's home directory.
 */
const expandTilde = (path: string): string => {
    if (path.startsWith('~/')) {
        return join(homedir(), path.slice(2));
    }
    if (path === '~') {
        return homedir();
    }
    return path;
};

/**
 * Get the config directory path, respecting CORTEX_CONFIG_PATH env var.
 *
 * Resolution order:
 * 1. CORTEX_CONFIG_PATH environment variable (if set)
 * 2. Default: ~/.config/cortex
 *
 * @returns Absolute path to the config directory
 *
 * @example
 * ```ts
 * // With CORTEX_CONFIG_PATH=/custom/path
 * getConfigDir(); // Returns '/custom/path'
 *
 * // Without env var
 * getConfigDir(); // Returns '/home/user/.config/cortex'
 * ```
 */
export const getConfigDir = (): string => {
    const envPath = process.env.CORTEX_CONFIG_PATH;
    if (envPath) {
        return expandTilde(envPath);
    }
    return join(homedir(), '.config', 'cortex');
};

/**
 * Get the full path to the config file.
 *
 * @returns Absolute path to config.yaml
 */
export const getConfigPath = (): string => {
    return join(getConfigDir(), 'config.yaml');
};

export interface CortexConfig {
    outputFormat?: OutputFormat;
    autoSummaryThreshold?: number;
    strictLocal?: boolean;
}

export type ConfigLoadErrorCode =
    | 'CONFIG_READ_FAILED'
    | 'CONFIG_PARSE_FAILED'
    | 'CONFIG_VALIDATION_FAILED';

export type ConfigValidationErrorCode =
    | 'INVALID_STORE_PATH'
    | 'CONFIG_VALIDATION_FAILED'
    | 'CONFIG_PARSE_FAILED'
    | 'CONFIG_READ_FAILED';

export interface ConfigValidationError {
    code: ConfigValidationErrorCode;
    message: string;
    store?: string;
    field?: string;
    line?: number;
    path?: string;
    cause?: unknown;
}

/**
 * Validates that a store path is absolute.
 *
 * Store paths must be absolute to ensure consistent resolution across
 * different working directories. Relative paths are rejected with an
 * actionable error message.
 *
 * @module core/config
 * @param storePath - The filesystem path to validate
 * @param storeName - The store name (used in error messages)
 * @returns Result with void on success, or validation error if path is relative
 *
 * @example
 * ```ts
 * const result = validateStorePath('/home/user/.cortex', 'default');
 * // result.ok() === true
 *
 * const invalid = validateStorePath('./relative', 'mystore');
 * // invalid.error.code === 'INVALID_STORE_PATH'
 * ```
 */
export const validateStorePath = (
    storePath: string,
    storeName: string,
): Result<void, ConfigValidationError> => {
    if (!isAbsolute(storePath)) {
        return err({
            code: 'INVALID_STORE_PATH',
            message: `Store '${storeName}' path must be absolute. Got: ${storePath}. ` +
                "Use an absolute path like '/home/user/.cortex/memory'.",
            store: storeName,
        });
    }
    return ok(undefined);
};

export interface ConfigLoadError {
    code: ConfigLoadErrorCode;
    message: string;
    path?: string;
    line?: number;
    field?: string;
    cause?: unknown;
}

export interface ConfigLoadOptions {
    cwd?: string;
    globalConfigPath?: string;
    localConfigPath?: string;
}

/**
 * Settings as represented in the config file (camelCase fields).
 */
export interface ConfigSettings {
    outputFormat: OutputFormat;
    autoSummaryThreshold: number;
    strictLocal: boolean;
}

export const getDefaultSettings = (): ConfigSettings => ({
    outputFormat: 'yaml',
    autoSummaryThreshold: 0,
    strictLocal: false,
});

export interface MergedConfig {
    settings: ConfigSettings;
    stores: StoreRegistry;
}

/**
 * Parse a unified config file with settings and stores sections.
 *
 * @param raw - Raw YAML string content
 * @returns Result with parsed MergedConfig or validation error
 *
 * @example
 * ```ts
 * const raw = `
 * settings:
 *   outputFormat: json
 * stores:
 *   default:
 *     path: /home/user/.config/cortex/memory
 * `;
 * const result = parseMergedConfig(raw);
 * ```
 */
export const parseMergedConfig = (raw: string): Result<MergedConfig, ConfigValidationError> => {
    // Define the expected structure from YAML
    interface ConfigFileContent {
        settings?: Partial<ConfigSettings>;
        stores?: Record<string, { path: string; description?: string }>;
    }

    let parsed: ConfigFileContent;
    try {
        parsed = Bun.YAML.parse(raw) as ConfigFileContent ?? {};
    }
    catch (error) {
        return err({
            code: 'CONFIG_PARSE_FAILED',
            message: 'Invalid YAML syntax in config file.',
            cause: error,
        });
    }

    // Get defaults
    const defaults = getDefaultSettings();

    // Merge settings with defaults
    const rawOutputFormat = parsed.settings?.outputFormat;
    if (rawOutputFormat !== undefined && ![
        'yaml',
        'json',
        'toon',
    ].includes(rawOutputFormat)) {
        return err({
            code: 'CONFIG_VALIDATION_FAILED',
            message: `Invalid outputFormat: '${rawOutputFormat}'. Must be 'yaml', 'json', or 'toon'.`,
            field: 'outputFormat',
        });
    }

    const settings: ConfigSettings = {
        outputFormat: (rawOutputFormat as OutputFormat) ?? defaults.outputFormat,
        autoSummaryThreshold: parsed.settings?.autoSummaryThreshold ?? defaults.autoSummaryThreshold,
        strictLocal: parsed.settings?.strictLocal ?? defaults.strictLocal,
    };

    // Validate and transform stores
    const stores: StoreRegistry = {};
    if (parsed.stores) {
        for (const [
            name, def,
        ] of Object.entries(parsed.stores)) {
            // Skip if path is missing
            if (!def.path) {
                return err({
                    code: 'INVALID_STORE_PATH',
                    message: `Store '${name}' must have a path.`,
                    store: name,
                });
            }

            // Validate absolute path
            const pathValidation = validateStorePath(def.path, name);
            if (!pathValidation.ok()) {
                return pathValidation;
            }

            stores[name] = {
                path: def.path,
                ...(def.description !== undefined && { description: def.description }),
            };
        }
    }

    return ok({ settings, stores });
};

/**
 * Serialize a MergedConfig back to YAML string format.
 *
 * @param config - The merged config to serialize
 * @returns Result with YAML string or validation error
 *
 * @example
 * ```ts
 * const config: MergedConfig = {
 *   settings: { outputFormat: 'json', autoSummaryThreshold: 10, strictLocal: true },
 *   stores: { default: { path: '/data/default' } },
 * };
 * const result = serializeMergedConfig(config);
 * ```
 */
export const serializeMergedConfig = (
    config: MergedConfig,
): Result<string, ConfigValidationError> => {
    // Validate store names before serialization
    for (const name of Object.keys(config.stores)) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
            return err({
                code: 'CONFIG_VALIDATION_FAILED',
                message: `Invalid store name: '${name}'. Store names must be lowercase kebab-case.`,
                store: name,
            });
        }
    }

    // Sort stores alphabetically for consistent output
    const sortedStores: Record<string, { path: string; description?: string }> = {};
    for (const name of Object.keys(config.stores).sort()) {
        sortedStores[name] = config.stores[name]!;
    }

    const yamlObject = {
        settings: config.settings,
        ...(Object.keys(sortedStores).length > 0 && { stores: sortedStores }),
    };

    return ok(Bun.YAML.stringify(yamlObject, null, 2).trimEnd());
};
