/**
 * Configuration definitions for store resolution and output defaults.
 */

import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { type Result, ok, err } from './result.ts';
import type { StoreRegistry } from './store/registry.ts';

export type OutputFormat = 'yaml' | 'json' | 'toon';

/**
 * Category creation/deletion mode for a store.
 * - `free` - Categories can be created/deleted freely (default)
 * - `subcategories` - Only subcategories of config-defined categories allowed
 * - `strict` - Only config-defined categories allowed
 */
export type CategoryMode = 'free' | 'subcategories' | 'strict';

/**
 * Definition of a category in the store configuration.
 * Supports arbitrary nesting depth via subcategories.
 */
export type CategoryDefinition = {
    /** Optional description (max 500 chars) */
    description?: string;
    /** Nested subcategories */
    subcategories?: Record<string, CategoryDefinition>;
};

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
 * Flattens a nested CategoryDefinition hierarchy to an array of paths.
 *
 * Recursively traverses the category hierarchy and collects all paths
 * at all nesting levels. Useful for listing all config-defined categories
 * or validating that a path exists in the hierarchy.
 *
 * @module core/config
 * @param categories - Record of category name to definition (may be undefined)
 * @param prefix - Path prefix for nested categories (used internally for recursion)
 * @returns Sorted array of all category paths at all nesting levels
 *
 * @example
 * ```typescript
 * const categories = {
 *     standards: {
 *         subcategories: {
 *             architecture: {},
 *             conventions: { subcategories: { naming: {} } },
 *         },
 *     },
 *     projects: {},
 * };
 *
 * flattenCategoryPaths(categories);
 * // Returns: [
 * //   'projects',
 * //   'standards',
 * //   'standards/architecture',
 * //   'standards/conventions',
 * //   'standards/conventions/naming'
 * // ]
 * ```
 *
 * @edgeCases
 * - Returns empty array when categories is undefined or empty
 * - Results are sorted alphabetically for consistent output
 * - Does not validate category names (accepts any string keys)
 */
export const flattenCategoryPaths = (
    categories: Record<string, CategoryDefinition> | undefined,
    prefix = '',
): string[] => {
    if (!categories) {
        return [];
    }

    const paths: string[] = [];
    for (const [
        name, def,
    ] of Object.entries(categories)) {
        const path = prefix ? `${prefix}/${name}` : name;
        paths.push(path);
        if (def.subcategories) {
            paths.push(...flattenCategoryPaths(def.subcategories, path));
        }
    }
    return paths.sort();
};

/**
 * Checks if a category path is defined in the config hierarchy.
 *
 * Recursively searches the config-defined categories to determine if
 * a given path exists either as a direct category or nested subcategory.
 * Used by category mode enforcement to distinguish config-defined paths
 * from user-created paths.
 *
 * @module core/config
 * @param path - Category path to check (e.g., "standards/architecture")
 * @param categories - Config-defined category hierarchy
 * @returns True if the path is defined in config, false otherwise
 *
 * @example
 * ```typescript
 * const categories = {
 *     standards: {
 *         subcategories: {
 *             architecture: {},
 *             conventions: {},
 *         },
 *     },
 *     projects: {},
 * };
 *
 * isConfigDefined('standards', categories);               // true
 * isConfigDefined('standards/architecture', categories);  // true
 * isConfigDefined('standards/conventions', categories);   // true
 * isConfigDefined('projects', categories);                // true
 * isConfigDefined('legacy', categories);                  // false
 * isConfigDefined('standards/unknown', categories);       // false
 * ```
 *
 * @edgeCases
 * - Empty path returns false
 * - Empty or undefined categories returns false for any path
 * - Paths with trailing slashes are not normalized (may return false)
 * - Path segments must match exactly (case-sensitive)
 */
export const isConfigDefined = (
    path: string,
    categories: Record<string, CategoryDefinition> | undefined,
): boolean => {
    if (!categories || !path) {
        return false;
    }

    const segments = path.split('/');
    let current: Record<string, CategoryDefinition> | undefined = categories;

    for (const segment of segments) {
        if (!current || !(segment in current)) {
            return false;
        }
        current = current[segment]?.subcategories;
    }

    return true;
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
 * Validates a category definition recursively.
 *
 * @param def - The raw category definition to validate
 * @param categoryPath - The path to this category (for error messages)
 * @param storeName - The store name (for error messages)
 * @returns Result with validated CategoryDefinition or validation error
 */
const validateCategoryDefinition = (
    def: unknown,
    categoryPath: string,
    storeName: string,
): Result<CategoryDefinition, ConfigValidationError> => {
    // Empty object or null/undefined is valid (no description, no subcategories)
    if (def === null || def === undefined || (typeof def === 'object' && Object.keys(def as object).length === 0)) {
        return ok({});
    }

    if (typeof def !== 'object') {
        return err({
            code: 'CONFIG_VALIDATION_FAILED',
            message: `Category '${categoryPath}' in store '${storeName}' must be an object.`,
            store: storeName,
            field: categoryPath,
        });
    }

    const defObj = def as Record<string, unknown>;
    const result: CategoryDefinition = {};

    // Validate description
    if ('description' in defObj) {
        if (typeof defObj.description !== 'string') {
            return err({
                code: 'CONFIG_VALIDATION_FAILED',
                message: `Category '${categoryPath}' description in store '${storeName}' must be a string.`,
                store: storeName,
                field: `${categoryPath}.description`,
            });
        }
        if (defObj.description.length > 500) {
            return err({
                code: 'CONFIG_VALIDATION_FAILED',
                message: `Category '${categoryPath}' description in store '${storeName}' exceeds 500 characters.`,
                store: storeName,
                field: `${categoryPath}.description`,
            });
        }
        result.description = defObj.description;
    }

    // Validate subcategories recursively
    if ('subcategories' in defObj) {
        if (typeof defObj.subcategories !== 'object' || defObj.subcategories === null) {
            return err({
                code: 'CONFIG_VALIDATION_FAILED',
                message: `Category '${categoryPath}' subcategories in store '${storeName}' must be an object.`,
                store: storeName,
                field: `${categoryPath}.subcategories`,
            });
        }

        const subcategories: Record<string, CategoryDefinition> = {};
        for (const [
            name, subDef,
        ] of Object.entries(defObj.subcategories as Record<string, unknown>)) {
            const subPath = categoryPath ? `${categoryPath}/${name}` : name;
            const subResult = validateCategoryDefinition(subDef, subPath, storeName);
            if (!subResult.ok()) {
                return subResult;
            }
            subcategories[name] = subResult.value;
        }
        result.subcategories = subcategories;
    }

    return ok(result);
};

/**
 * Validates a category hierarchy from config.
 *
 * @param categories - The raw categories object from config
 * @param storeName - The store name (for error messages)
 * @returns Result with validated category hierarchy or validation error
 */
const validateCategoryHierarchy = (
    categories: unknown,
    storeName: string,
): Result<Record<string, CategoryDefinition>, ConfigValidationError> => {
    if (categories === null || categories === undefined) {
        return ok({});
    }

    if (typeof categories !== 'object') {
        return err({
            code: 'CONFIG_VALIDATION_FAILED',
            message: `Categories in store '${storeName}' must be an object.`,
            store: storeName,
            field: 'categories',
        });
    }

    const result: Record<string, CategoryDefinition> = {};
    for (const [
        name, def,
    ] of Object.entries(categories as Record<string, unknown>)) {
        const defResult = validateCategoryDefinition(def, name, storeName);
        if (!defResult.ok()) {
            return defResult;
        }
        result[name] = defResult.value;
    }

    return ok(result);
};

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
    // Valid category modes
    const validCategoryModes: readonly CategoryMode[] = [
        'free',
        'subcategories',
        'strict',
    ] as const;

    // Define the expected structure from YAML
    interface ConfigFileContent {
        settings?: Partial<ConfigSettings>;
        stores?: Record<string, {
            path: string;
            description?: string;
            categoryMode?: string;
            categories?: Record<string, unknown>;
        }>;
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
        autoSummaryThreshold:
            parsed.settings?.autoSummaryThreshold ?? defaults.autoSummaryThreshold,
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

            // Validate category mode
            const rawCategoryMode = def.categoryMode;
            const isValidMode = rawCategoryMode !== undefined &&
                validCategoryModes.includes(rawCategoryMode as CategoryMode);
            if (rawCategoryMode !== undefined && !isValidMode) {
                return err({
                    code: 'CONFIG_VALIDATION_FAILED',
                    message: `Invalid categoryMode '${rawCategoryMode}' in store '${name}'. ` +
                        'Must be \'free\', \'subcategories\', or \'strict\'.',
                    store: name,
                    field: 'categoryMode',
                });
            }

            // Validate categories
            const categoriesResult = validateCategoryHierarchy(def.categories, name);
            if (!categoriesResult.ok()) {
                return categoriesResult;
            }

            stores[name] = {
                path: def.path,
                ...(def.description !== undefined && { description: def.description }),
                ...(rawCategoryMode !== undefined && {
                    categoryMode: rawCategoryMode as CategoryMode,
                }),
                ...(Object.keys(categoriesResult.value).length > 0 && {
                    categories: categoriesResult.value,
                }),
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
