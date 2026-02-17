/**
 * Configuration definitions for store resolution and output defaults.
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
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

/**
 * Settings as represented in the config file (snake_case fields).
 */
export interface ConfigSettings {
    output_format: OutputFormat;
    auto_summary: boolean;
    strict_local: boolean;
}

export const getDefaultSettings = (): ConfigSettings => ({
    output_format: 'yaml',
    auto_summary: false,
    strict_local: false,
});

export interface MergedConfig {
    settings: ConfigSettings;
    stores: StoreRegistry;
}

export interface CortexConfig {
    outputFormat?: OutputFormat;
    autoSummaryThreshold?: number;
    strictLocal?: boolean;
    strict_local?: boolean;
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

const configKeys = new Set([
    'output_format',
    'auto_summary_threshold',
    'strict_local',
]);
const keyFormat = /^[a-z0-9_]+$/;

const isNotFoundError = (error: unknown): boolean =>
    !!error && typeof error === 'object' && 'code' in error
        ? (error as { code?: string }).code === 'ENOENT'
        : false;

const parseScalarValue = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) {
        return '';
    }
    const quotedMatch = /^(['"])(.*)\1(\s+#.*)?$/.exec(trimmed);
    if (quotedMatch) {
        return quotedMatch[2] ?? '';
    }
    const commentMatch = /^(.*?)(\s+#.*)?$/.exec(trimmed);
    return (commentMatch?.[1] ?? '').trim();
};

const parseOutputFormat = (value: string, line: number): Result<OutputFormat, ConfigLoadError> => {
    if (value === 'yaml' || value === 'json' || value === 'toon') {
        return ok(value);
    }
    return err({
        code: 'CONFIG_VALIDATION_FAILED',
        message: 'output_format must be yaml, json, or toon.',
        field: 'output_format',
        line,
    });
};

const parseBoolean = (value: string, line: number): Result<boolean, ConfigLoadError> => {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
        return ok(true);
    }
    if (normalized === 'false') {
        return ok(false);
    }
    return err({
        code: 'CONFIG_VALIDATION_FAILED',
        message: 'strict_local must be true or false.',
        field: 'strict_local',
        line,
    });
};

const parseNumber = (value: string, line: number): Result<number, ConfigLoadError> => {
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        return err({
            code: 'CONFIG_VALIDATION_FAILED',
            message: 'auto_summary_threshold must be a whole number.',
            field: 'auto_summary_threshold',
            line,
        });
    }
    if (parsed < 0) {
        return err({
            code: 'CONFIG_VALIDATION_FAILED',
            message: 'auto_summary_threshold must be zero or greater.',
            field: 'auto_summary_threshold',
            line,
        });
    }
    return ok(parsed);
};

const parseConfigLine = (
    rawLine: string,
    lineNumber: number,
): Result<{ key: string; value: string }, ConfigLoadError> => {
    const match = /^\s*([^:]+)\s*:\s*(.*)$/.exec(rawLine);
    if (!match) {
        return err({
            code: 'CONFIG_PARSE_FAILED',
            message: 'Invalid config entry.',
            line: lineNumber,
        });
    }
    const key = match[1]?.trim();
    if (!key) {
        return err({
            code: 'CONFIG_PARSE_FAILED',
            message: 'Invalid config entry.',
            line: lineNumber,
        });
    }
    return ok({ key, value: match[2] ?? '' });
};

const applyConfigValue = (
    config: CortexConfig,
    key: string,
    rawValue: string,
    lineNumber: number,
): Result<void, ConfigLoadError> => {
    switch (key) {
        case 'output_format': {
            const parsed = parseOutputFormat(rawValue, lineNumber);
            if (!parsed.ok()) {
                return parsed;
            }
            config.outputFormat = parsed.value;
            return ok(undefined);
        }
        case 'auto_summary_threshold': {
            const parsed = parseNumber(rawValue, lineNumber);
            if (!parsed.ok()) {
                return parsed;
            }
            config.autoSummaryThreshold = parsed.value;
            return ok(undefined);
        }
        case 'strict_local': {
            const parsed = parseBoolean(rawValue, lineNumber);
            if (!parsed.ok()) {
                return parsed;
            }
            config.strictLocal = parsed.value;
            config.strict_local = parsed.value;
            return ok(undefined);
        }
        default:
            return ok(undefined);
    }
};

const validateConfigKey = (
    key: string,
    lineNumber: number,
    seenKeys: Set<string>,
): Result<void, ConfigLoadError> => {
    if (!keyFormat.test(key)) {
        return err({
            code: 'CONFIG_VALIDATION_FAILED',
            message: 'Config keys must be lowercase snake_case (e.g. output_format).',
            field: key,
            line: lineNumber,
        });
    }
    if (!configKeys.has(key)) {
        return err({
            code: 'CONFIG_VALIDATION_FAILED',
            message: `Unsupported config field: ${key}. Supported fields: ` +
                'output_format, auto_summary_threshold, strict_local.',
            field: key,
            line: lineNumber,
        });
    }
    if (seenKeys.has(key)) {
        return err({
            code: 'CONFIG_PARSE_FAILED',
            message: `Duplicate config field: ${key}.`,
            field: key,
            line: lineNumber,
        });
    }
    return ok(undefined);
};

const parseConfigValue = (
    rawValue: string,
    key: string,
    lineNumber: number,
): Result<string, ConfigLoadError> => {
    const parsed = parseScalarValue(rawValue);
    if (parsed) {
        return ok(parsed);
    }
    return err({
        code: 'CONFIG_VALIDATION_FAILED',
        message: `Empty value for ${key} at line ${lineNumber}.`,
        field: key,
        line: lineNumber,
    });
};

const readAndParseConfig = async (path: string): Promise<Result<CortexConfig, ConfigLoadError>> => {
    const readResult = await readConfigFile(path);
    if (!readResult.ok()) {
        return readResult;
    }
    if (!readResult.value) {
        return ok({});
    }
    const parsed = parseConfig(readResult.value);
    if (!parsed.ok()) {
        return err({ ...parsed.error, path });
    }
    return ok(parsed.value);
};

export const parseConfig = (raw: string): Result<CortexConfig, ConfigLoadError> => {
    const normalized = raw.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const config: CortexConfig = {};
    const seenKeys = new Set<string>();

    for (let index = 0; index < lines.length; index += 1) {
        const rawLine = lines[index];
        if (rawLine === undefined) {
            continue;
        }
        const lineNumber = index + 1;
        const trimmed = rawLine.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const parsedLine = parseConfigLine(rawLine, lineNumber);
        if (!parsedLine.ok()) {
            return parsedLine;
        }
        const key = parsedLine.value.key;
        const validated = validateConfigKey(key, lineNumber, seenKeys);
        if (!validated.ok()) {
            return validated;
        }
        seenKeys.add(key);

        const rawValue = parseConfigValue(parsedLine.value.value, key, lineNumber);
        if (!rawValue.ok()) {
            return rawValue;
        }
        const applied = applyConfigValue(config, key, rawValue.value, lineNumber);
        if (!applied.ok()) {
            return applied;
        }
    }

    return ok(config);
};

const resolveConfigPath = (cwd: string, path: string): string =>
    isAbsolute(path) ? path : resolve(cwd, path);

const readConfigFile = async (path: string): Promise<Result<string | null, ConfigLoadError>> => {
    try {
        const contents = await readFile(path, 'utf8');
        return ok(contents);
    }
    catch (error) {
        if (isNotFoundError(error)) {
            return ok(null);
        }
        return err({
            code: 'CONFIG_READ_FAILED',
            message: `Failed to read config file at ${path}.`,
            path,
            cause: error,
        });
    }
};

export const loadConfig = async (
    options: ConfigLoadOptions = {},
): Promise<Result<CortexConfig, ConfigLoadError>> => {
    const cwd = options.cwd ?? process.cwd();
    const globalPath = resolveConfigPath(
        cwd,
        options.globalConfigPath ?? resolve(homedir(), '.config', 'cortex', 'config.yaml'),
    );
    const localPath = resolveConfigPath(
        cwd,
        options.localConfigPath ?? resolve(cwd, '.cortex', 'config.yaml'),
    );

    const globalConfig = await readAndParseConfig(globalPath);
    if (!globalConfig.ok()) {
        return globalConfig;
    }

    const localConfig = await readAndParseConfig(localPath);
    if (!localConfig.ok()) {
        return localConfig;
    }

    return ok({
        ...globalConfig.value,
        ...localConfig.value,
    });
};

// ---------------------------------------------------------------------------
// Merged Config Parsing and Serialization
// ---------------------------------------------------------------------------

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
 *   output_format: json
 * stores:
 *   default:
 *     path: /home/user/.cortex/memory
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
    const rawOutputFormat = parsed.settings?.output_format;
    if (rawOutputFormat !== undefined && ![
        'yaml',
        'json',
        'toon',
    ].includes(rawOutputFormat)) {
        return err({
            code: 'CONFIG_VALIDATION_FAILED',
            message: `Invalid output_format: '${rawOutputFormat}'. Must be 'yaml', 'json', or 'toon'.`,
            field: 'output_format',
        });
    }

    const settings: ConfigSettings = {
        output_format: (rawOutputFormat as OutputFormat) ?? defaults.output_format,
        auto_summary: parsed.settings?.auto_summary ?? defaults.auto_summary,
        strict_local: parsed.settings?.strict_local ?? defaults.strict_local,
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
 *   settings: { output_format: 'json', auto_summary: false, strict_local: true },
 *   stores: { default: { path: '/data/default' } },
 * };
 * const result = serializeMergedConfig(config);
 * ```
 */
export const serializeMergedConfig = (
    config: MergedConfig,
): Result<string, ConfigValidationError> => {
    const lines: string[] = [];

    // Settings section
    lines.push('settings:');
    lines.push(`  output_format: ${config.settings.output_format}`);
    lines.push(`  auto_summary: ${config.settings.auto_summary}`);
    lines.push(`  strict_local: ${config.settings.strict_local}`);

    // Stores section (if any stores exist)
    if (Object.keys(config.stores).length > 0) {
        lines.push('stores:');
        const sortedStores = Object.entries(config.stores).sort(([a], [b]) => a.localeCompare(b));
        for (const [
            name, def,
        ] of sortedStores) {
            // Validate store name
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
                return err({
                    code: 'CONFIG_VALIDATION_FAILED',
                    message: `Invalid store name: '${name}'. Store names must be lowercase kebab-case.`,
                    store: name,
                });
            }
            lines.push(`  ${name}:`);
            lines.push(`    path: ${JSON.stringify(def.path)}`);
            if (def.description !== undefined) {
                lines.push(`    description: ${JSON.stringify(def.description)}`);
            }
        }
    }

    return ok(lines.join('\n'));
};
