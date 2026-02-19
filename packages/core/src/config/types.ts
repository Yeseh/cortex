import type { CategoryMode, ConfiguredCategories, outputFormat } from "./config";

/**
 * Error codes for Cortex configuration operations.
 *
 * @module core/cortex/types
 *
 * - `CONFIG_NOT_FOUND` - Configuration file does not exist at expected path
 * - `CONFIG_READ_FAILED` - Failed to read configuration file (permissions, I/O error)
 * - `CONFIG_PARSE_FAILED` - Configuration file contains invalid YAML/JSON syntax
 * - `CONFIG_VALIDATION_FAILED` - Configuration values fail schema validation
 *
 * @example
 * ```typescript
 * function handleConfigError(error: ConfigError): void {
 *     switch (error.code) {
 *         case 'CONFIG_NOT_FOUND':
 *             console.log('Run "cortex init" to create configuration');
 *             break;
 *         case 'CONFIG_PARSE_FAILED':
 *             console.log(`Fix syntax error at line ${error.line}`);
 *             break;
 *         default:
 *             console.log(error.message);
 *     }
 * }
 * ```
 */
export type ConfigErrorCode =
    | 'CONFIG_NOT_FOUND'
    | 'CONFIG_READ_FAILED'
    | 'CONFIG_PARSE_FAILED'
    | 'CONFIG_VALIDATION_FAILED';

/**
 * Error returned when loading Cortex configuration fails.
 *
 * @module core/cortex/types
 *
 * @example
 * ```typescript
 * const error: ConfigError = {
 *     code: 'CONFIG_PARSE_FAILED',
 *     message: 'Invalid YAML syntax: unexpected indentation',
 *     path: '/home/user/.config/cortex/config.yaml',
 *     line: 15,
 *     cause: new SyntaxError('Unexpected token'),
 * };
 * ```
 */
export interface ConfigError {
    /** Machine-readable error code */
    code: ConfigErrorCode;
    /** Human-readable error message */
    message: string;
    /** Path to the config file (when applicable) */
    path?: string;
    /** Line number in config file (for parse errors) */
    line?: number;
    /** Underlying error cause (for debugging) */
    cause?: unknown;
}


export type StoreDefinition = {
    path: string;
    description?: string | undefined;
    categoryMode?: CategoryMode;
    categories: ConfiguredCategories
} 

export type CategoryDefinition = {
    description?: string;
    subcategories?: Record<string, CategoryDefinition>;
};

export type CortexSettings = {
    defaultStore?: string;
    outputFormat?: 'json' | 'yaml' | 'text';
}

export type ConfigCategory = CategoryDefinition;
export type ConfigCategories = Record<string, CategoryDefinition>;
export type Registry = Record<string, StoreDefinition>; 