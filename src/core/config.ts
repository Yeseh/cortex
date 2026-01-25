/**
 * Configuration definitions for store resolution and output defaults.
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import type { Result } from './types.ts';

export type OutputFormat = 'yaml' | 'json';

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

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

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
        return quotedMatch[ 2 ] ?? ''; 
    }
    const commentMatch = /^(.*?)(\s+#.*)?$/.exec(trimmed);
    return (commentMatch?.[ 1 ] ?? '').trim();
};

const parseOutputFormat = (
    value: string, line: number,
): Result<OutputFormat, ConfigLoadError> => {
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

const parseBoolean = (
    value: string, line: number,
): Result<boolean, ConfigLoadError> => {
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

const parseNumber = (
    value: string, line: number,
): Result<number, ConfigLoadError> => {
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
    const key = match[ 1 ]?.trim();
    if (!key) {
        return err({
            code: 'CONFIG_PARSE_FAILED',
            message: 'Invalid config entry.',
            line: lineNumber,
        }); 
    }
    return ok({ key, value: match[ 2 ] ?? '' });
};

const applyConfigValue = (
    config: CortexConfig,
    key: string,
    rawValue: string,
    lineNumber: number,
): Result<void, ConfigLoadError> => {
    switch (key) {
        case 'output_format': {
            const parsed = parseOutputFormat(
                rawValue, lineNumber,
            );
            if (!parsed.ok) {
                return parsed; 
            }
            config.outputFormat = parsed.value;
            return ok(undefined);
        }
        case 'auto_summary_threshold': {
            const parsed = parseNumber(
                rawValue, lineNumber,
            );
            if (!parsed.ok) {
                return parsed; 
            }
            config.autoSummaryThreshold = parsed.value;
            return ok(undefined);
        }
        case 'strict_local': {
            const parsed = parseBoolean(
                rawValue, lineNumber,
            );
            if (!parsed.ok) {
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

const readAndParseConfig = async (path: string)
: Promise<Result<CortexConfig, ConfigLoadError>> => {
    const readResult = await readConfigFile(path);
    if (!readResult.ok) {
        return readResult; 
    }
    if (!readResult.value) {
        return ok({}); 
    }
    const parsed = parseConfig(readResult.value);
    if (!parsed.ok) {
        return err({ ...parsed.error, path }); 
    }
    return ok(parsed.value);
};

export const parseConfig = (raw: string): Result<CortexConfig, ConfigLoadError> => {
    const normalized = raw.replace(
        /\r\n/g, '\n',
    );
    const lines = normalized.split('\n');
    const config: CortexConfig = {};
    const seenKeys = new Set<string>();

    for (let index = 0; index < lines.length; index += 1) {
        const rawLine = lines[ index ];
        if (rawLine === undefined) {
            continue; 
        }
        const lineNumber = index + 1;
        const trimmed = rawLine.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue; 
        }

        const parsedLine = parseConfigLine(
            rawLine, lineNumber,
        );
        if (!parsedLine.ok) {
            return parsedLine; 
        }
        const key = parsedLine.value.key;
        const validated = validateConfigKey(
            key, lineNumber, seenKeys,
        );
        if (!validated.ok) {
            return validated; 
        }
        seenKeys.add(key);

        const rawValue = parseConfigValue(
            parsedLine.value.value, key, lineNumber,
        );
        if (!rawValue.ok) {
            return rawValue; 
        }
        const applied = applyConfigValue(
            config, key, rawValue.value, lineNumber,
        );
        if (!applied.ok) {
            return applied; 
        }
    }

    return ok(config);
};

const resolveConfigPath = (
    cwd: string, path: string,
): string =>
    isAbsolute(path) ? path : resolve(
        cwd, path,
    );

const readConfigFile = async (path: string)
: Promise<Result<string | null, ConfigLoadError>> => {
    try {
        const contents = await readFile(
            path, 'utf8',
        );
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

export const loadConfig = async (options: ConfigLoadOptions = {})
: Promise<Result<CortexConfig, ConfigLoadError>> => {
    const cwd = options.cwd ?? process.cwd();
    const globalPath = resolveConfigPath(
        cwd,
        options.globalConfigPath ?? resolve(
            homedir(), '.config', 'cortex', 'config.yaml',
        ),
    );
    const localPath = resolveConfigPath(
        cwd,
        options.localConfigPath ?? resolve(
            cwd, '.cortex', 'config.yaml',
        ),
    );

    const globalConfig = await readAndParseConfig(globalPath);
    if (!globalConfig.ok) {
        return globalConfig; 
    }

    const localConfig = await readAndParseConfig(localPath);
    if (!localConfig.ok) {
        return localConfig; 
    }

    return ok({
        ...globalConfig.value,
        ...localConfig.value,
    });
};
