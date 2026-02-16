/**
 * Configuration definitions for store resolution and output defaults.
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { type Result, ok, err } from './result.ts';
import type { StoreDefinition } from './store/registry.ts';

export type OutputFormat = 'yaml' | 'json';

export interface CortexConfig {
    outputFormat?: OutputFormat;
    autoSummaryThreshold?: number;
    strictLocal?: boolean;
    strict_local?: boolean;
}

/**
 * Output format options including token-optimized format.
 */
export type OutputFormatWithToon = 'yaml' | 'json' | 'toon';

/**
 * Settings for the Cortex client.
 * These are loaded from the `settings:` section of config.yaml.
 */
export interface CortexSettings {
    /** Output format for CLI and API responses */
    outputFormat: OutputFormatWithToon;
    /** Whether to enable auto-summary for large content */
    autoSummary: boolean;
    /** If true, only use local .cortex store, never fall back to global */
    strictLocal: boolean;
}

/** Default settings when not specified in config */
export const DEFAULT_CORTEX_SETTINGS: CortexSettings = {
    outputFormat: 'yaml',
    autoSummary: false,
    strictLocal: false,
};

/**
 * Merged config file structure with settings and stores sections.
 */
export interface MergedConfig {
    settings: CortexSettings;
    stores: Record<string, StoreDefinition>;
}

export type MergedConfigLoadErrorCode =
    | 'CONFIG_NOT_FOUND'
    | 'CONFIG_READ_FAILED'
    | 'CONFIG_PARSE_FAILED'
    | 'INVALID_STORE_PATH';

export interface MergedConfigLoadError {
    code: MergedConfigLoadErrorCode;
    message: string;
    path?: string;
    field?: string;
    cause?: unknown;
}

/**
 * Zod schema for store definition.
 */
const storeDefinitionSchema = z.object({
    path: z.string().optional(),
    description: z.string().optional(),
}).superRefine((data, ctx) => {
    if (typeof data.path !== 'string' || data.path.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Store must have a non-empty path',
            path: ['path'],
        });
        return;
    }
    if (!isAbsolute(data.path)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Store path must be absolute',
            path: ['path'],
        });
    }
}).transform((data) => ({
    path: data.path as string,
    description: data.description,
}));

/**
 * Zod schema for Cortex settings.
 */
const cortexSettingsSchema = z.object({
    output_format: z.enum(['yaml', 'json', 'toon']).optional(),
    auto_summary: z.boolean().optional(),
    strict_local: z.boolean().optional(),
}).transform((s) => ({
    outputFormat: s.output_format ?? DEFAULT_CORTEX_SETTINGS.outputFormat,
    autoSummary: s.auto_summary ?? DEFAULT_CORTEX_SETTINGS.autoSummary,
    strictLocal: s.strict_local ?? DEFAULT_CORTEX_SETTINGS.strictLocal,
}));

/**
 * Zod schema for merged config file.
 */
const mergedConfigSchema = z.object({
    settings: cortexSettingsSchema.optional().default({ ...DEFAULT_CORTEX_SETTINGS }),
    stores: z.record(z.string(), storeDefinitionSchema).optional().default({}),
});

export type ConfigLoadErrorCode =
    | 'CONFIG_READ_FAILED'
    | 'CONFIG_PARSE_FAILED'
    | 'CONFIG_VALIDATION_FAILED';

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

const configKeys = new Set(['output_format', 'auto_summary_threshold', 'strict_local']);
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
    if (value === 'yaml' || value === 'json') {
        return ok(value);
    }
    return err({
        code: 'CONFIG_VALIDATION_FAILED',
        message: 'output_format must be yaml or json.',
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
    lineNumber: number
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
    lineNumber: number
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
    seenKeys: Set<string>
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
            message: `Unsupported config field: ${key}. Supported fields: output_format, auto_summary_threshold, strict_local.`,
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
    lineNumber: number
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
    } catch (error) {
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
    options: ConfigLoadOptions = {}
): Promise<Result<CortexConfig, ConfigLoadError>> => {
    const cwd = options.cwd ?? process.cwd();
    const globalPath = resolveConfigPath(
        cwd,
        options.globalConfigPath ?? resolve(homedir(), '.config', 'cortex', 'config.yaml')
    );
    const localPath = resolveConfigPath(
        cwd,
        options.localConfigPath ?? resolve(cwd, '.cortex', 'config.yaml')
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
// Merged Config Parsing (settings + stores in a single file)
// ---------------------------------------------------------------------------

/**
 * Parses a merged config file containing settings and stores sections.
 *
 * @module config
 * @param raw - Raw YAML content
 * @returns Result with parsed config or error
 *
 * @example
 * ```ts
 * const yaml = `
 * settings:
 *   output_format: json
 * stores:
 *   default:
 *     path: /home/user/.config/cortex/memory
 * `;
 * const result = parseMergedConfig(yaml);
 * if (result.ok()) {
 *   console.log(result.value.settings.outputFormat); // 'json'
 * }
 * ```
 */
export const parseMergedConfig = (raw: string): Result<MergedConfig, MergedConfigLoadError> => {
    let parsed: unknown;
    try {
        parsed = Bun.YAML.parse(raw);
    } catch (error) {
        return err({
            code: 'CONFIG_PARSE_FAILED',
            message: 'Failed to parse config YAML',
            cause: error,
        });
    }

    // Handle empty file
    if (parsed === null || parsed === undefined) {
        return ok({
            settings: { ...DEFAULT_CORTEX_SETTINGS },
            stores: {},
        });
    }

    const result = mergedConfigSchema.safeParse(parsed);
    if (!result.success) {
        const issue = result.error.issues[0];
        const path = issue?.path.join('.') || 'unknown';
        return err({
            code: issue?.code === 'custom' && issue.message.includes('absolute') 
                ? 'INVALID_STORE_PATH' 
                : 'CONFIG_PARSE_FAILED',
            message: issue?.message || 'Invalid config format',
            field: path,
        });
    }

    return ok({
        settings: result.data.settings as CortexSettings,
        stores: result.data.stores,
    });
};

/**
 * Serializes a merged config to YAML format.
 *
 * @module config
 * @param config - The config to serialize
 * @returns YAML string
 *
 * @example
 * ```ts
 * const config = {
 *   settings: { outputFormat: 'json', autoSummary: true, strictLocal: false },
 *   stores: { default: { path: '/tmp/store' } },
 * };
 * const yaml = serializeMergedConfig(config);
 * ```
 */
export const serializeMergedConfig = (config: MergedConfig): string => {
    const obj: Record<string, unknown> = {};

    // Only include settings if they differ from defaults
    const hasNonDefaultSettings =
        config.settings.outputFormat !== DEFAULT_CORTEX_SETTINGS.outputFormat ||
        config.settings.autoSummary !== DEFAULT_CORTEX_SETTINGS.autoSummary ||
        config.settings.strictLocal !== DEFAULT_CORTEX_SETTINGS.strictLocal;

    if (hasNonDefaultSettings) {
        obj.settings = {
            output_format: config.settings.outputFormat,
            auto_summary: config.settings.autoSummary,
            strict_local: config.settings.strictLocal,
        };
    }

    // Only include stores if there are any
    if (Object.keys(config.stores).length > 0) {
        obj.stores = Object.fromEntries(
            Object.entries(config.stores)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, def]) => [
                    name,
                    {
                        path: def.path,
                        ...(def.description && { description: def.description }),
                    },
                ])
        );
    }

    return Bun.YAML.stringify(obj);
};
