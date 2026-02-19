/**
 * Configuration definitions for store resolution and output defaults.
 */

import { type Result, ok, err } from '../result.ts';
import z from 'zod';
import type { CategoryDefinition, ConfigCategories, CortexSettings } from './types.ts';

/**
 * Category creation/deletion mode for a store.
 * - `free` - Categories can be created/deleted freely (default)
 * - `subcategories` - Only subcategories of config-defined categories allowed
 * - `strict` - Only config-defined categories allowed
 */
export const categoryMode = z.enum(['free', 'subcategories', 'strict']);
export type CategoryMode = z.infer<typeof categoryMode>;

export const category = z.object({
    description: z.string().optional(),
    subcategories: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Output formats for handlers that support multiple formats. 
 */
export const outputFormat = z.enum(['yaml', 'json', 'toon']);
export type OutputFormat = z.infer<typeof outputFormat>;

/**
 * Schema for settings section of config.yaml.
 */
const settingsSchema = z
    .strictObject({
        outputFormat: outputFormat.optional(),
        defaultStore: z.string().optional(),
    })
    .optional();
/**
 * Settings as represented in the config  
 */
export const getDefaultSettings = (): CortexSettings => ({
    outputFormat: 'yaml',
    defaultStore: 'default',
});

const categoriesSchema = z.record(z.string(), z.unknown()).optional();
export type ConfiguredCategories = z.infer<typeof categoriesSchema>;

/**
 * Schema for a single store definition.
 */
const storeDefinitionSchema = z.object({
    path: z.string().min(1, 'Store path must be a non-empty string'),
    description: z.string().optional(),
    categoryMode: categoryMode.optional(),
    categories: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Schema for stores section of config.yaml.
 */
const storesSchema = z
    .record(
        z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Store name must be a lowercase slug'),
        storeDefinitionSchema,
    )

/**
 * Schema for the entire config.yaml file.
 */
export const configFileSchema = z.object({
    settings: settingsSchema,
    stores: storesSchema,
});
export type CortexConfig = z.infer<typeof configFileSchema>;

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
    categories: ConfigCategories | undefined,
    prefix = '',
): string[] => {
    if (!categories) {
        return [];
    }

    const paths: string[] = [];
    const entries = Object.entries(categories) as [string, CategoryDefinition][];

    for (const [name, def] of entries) {
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
    categories: ConfigCategories | undefined,
): boolean => {
    if (!categories || !path) {
        return false;
    }

    const segments = path.split('/');
    let current: ConfigCategories | undefined = categories;

    for (const segment of segments) {
        if (!current) {
            return false;
        }

        const category: CategoryDefinition | undefined = current[segment];
        if (!category) {
            return false;
        }

        current = category.subcategories;
    }

    return true;
};

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

export interface ConfigLoadError {
    code: ConfigLoadErrorCode;
    message: string;
    path?: string;
    line?: number;
    field?: string;
    cause?: unknown;
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
 * @returns Result with parsed CortexConfig or validation error
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
export const parseConfig = (raw: string): Result<CortexConfig, ConfigValidationError> => {
    let config: CortexConfig;
    try {
        const yamlParse = Bun.YAML.parse(raw) ?? {};
        config = configFileSchema.parse(yamlParse) as CortexConfig;
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return err({
                code: 'CONFIG_VALIDATION_FAILED',
                message: 'Config validation failed: ' + error.issues.map(e => `${e.path.join('.')} - ${e.message}`).join('; '),
                cause: error.message,
            });
        }
        return err({
            code: 'CONFIG_PARSE_FAILED',
            message: 'Invalid YAML syntax in config file.',
            cause: error,
        });
    }

    // Get defaults
    if (config.stores) {
        for (const key of Object.keys(config.stores)) {
            const def = config.stores[key]!;

            // Skip if path is missing
            if (!def.path) {
                return err({
                    code: 'INVALID_STORE_PATH',
                    message: `Store '${key}' must have a path.`,
                    store: key,
                });
            }

            // Validate categories
            const categoriesResult = validateCategoryHierarchy(def.categories, key);
            if (!categoriesResult.ok()) {
                return categoriesResult;
            }
        }
    }

    return ok(config);
};
