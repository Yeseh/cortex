/**
 * Store registry parsing and validation
 */

import { ok } from '@/result.ts';
import type { StoreResult } from './result.ts';
import { storeError, type StoreRegistryParseError } from './result.ts';

export interface StoreDefinition {
    path: string;
    description?: string;
}

export type Registry = Record<string, StoreDefinition>;

export type { StoreRegistryParseErrorCode, StoreRegistryParseError } from './result.ts';

type SerializeRegistryResult = StoreResult<string, StoreRegistrySerializeError>;

const storeNameSegment = '[a-z0-9]+(?:-[a-z0-9]+)*';
const storeNamePattern = new RegExp(`^${storeNameSegment}$`);

export const isValidStoreName = (name: string): boolean => storeNamePattern.test(name);

const parsePathValue = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) {
        return '';
    }
    const quotedMatch = /^(['"])(.*)\1(\s+#.*)?$/.exec(trimmed);
    if (quotedMatch) {
        const rawValue = quotedMatch[2] ?? '';
        if (quotedMatch[1] === '"') {
            try {
                const parsed = JSON.parse(`"${rawValue}"`);
                if (typeof parsed === 'string') {
                    return parsed;
                }
            }
            catch {
                return rawValue;
            }
        }
        return rawValue;
    }
    const commentMatch = /^(.*?)(\s+#.*)?$/.exec(trimmed);
    return (commentMatch?.[1] ?? '').trim();
};

const isStoreHeader = (content: string): string | null => {
    const storeMatch = new RegExp(`^(${storeNameSegment})\\s*:\\s*$`).exec(content);
    return storeMatch?.[1] ?? null;
};

const parseIndent = (line: string): { indent: number; content: string } => {
    const indentMatch = /^(\s*)(.*)$/.exec(line);
    return {
        indent: indentMatch?.[1]?.length ?? 0,
        content: indentMatch?.[2]?.trim() ?? '',
    };
};

const isPathEntry = (content: string): string | null => {
    const pathMatch = /^path\s*:\s*(.*)$/.exec(content);
    return pathMatch?.[1] ?? null;
};

const isDescriptionEntry = (content: string): string | null => {
    const descMatch = /^description\s*:\s*(.*)$/.exec(content);
    return descMatch?.[1] ?? null;
};

interface RegistryState {
    mode: 'unknown' | 'stores' | 'root';
    storesIndent: number;
    currentStore: {
        name: string;
        indent: number;
        line: number;
        path?: string;
        description?: string;
    } | null;
    hasStoreEntries: boolean;
    registry: Registry;
}

const validateStoreIndent = (
    mode: RegistryState['mode'],
    indent: number,
    storesIndent: number,
    line: number,
): StoreResult<void, StoreRegistryParseError> => {
    if (mode === 'stores' && indent <= storesIndent) {
        return storeError('UNEXPECTED_ENTRY', "Store entries must be indented under 'stores:'.", {
            line,
        });
    }
    if (mode === 'root' && indent !== 0) {
        return storeError('UNEXPECTED_ENTRY', 'Store entries must be at the top level.', {
            line,
        });
    }
    return ok(undefined);
};

const finalizeStore = (
    state: RegistryState,
): StoreResult<RegistryState, StoreRegistryParseError> => {
    if (state.currentStore && !state.currentStore.path) {
        return storeError('MISSING_STORE_PATH', 'Store entry must include a path.', {
            line: state.currentStore.line,
            store: state.currentStore.name,
        });
    }
    // If store was finalized but description was provided after path,
    // ensure it's in the registry
    if (state.currentStore?.path && state.currentStore?.description !== undefined) {
        const existingDef = state.registry[state.currentStore.name];
        if (existingDef && existingDef.description === undefined) {
            return ok({
                ...state,
                registry: {
                    ...state.registry,
                    [state.currentStore.name]: {
                        ...existingDef,
                        description: state.currentStore.description,
                    },
                },
                currentStore: null,
            });
        }
    }
    return ok({ ...state, currentStore: null });
};

const handleStoreHeader = (
    state: RegistryState,
    storeName: string,
    indent: number,
    line: number,
): StoreResult<RegistryState, StoreRegistryParseError> => {
    const nextMode = state.mode === 'unknown' ? 'root' : state.mode;
    const indentResult = validateStoreIndent(nextMode, indent, state.storesIndent, line);
    if (!indentResult.ok()) {
        return indentResult;
    }
    const finalized = finalizeStore({ ...state, mode: nextMode });
    if (!finalized.ok()) {
        return finalized;
    }
    if (!isValidStoreName(storeName)) {
        return storeError('INVALID_STORE_NAME', 'Store names must be lowercase slugs.', {
            line,
        });
    }
    if (finalized.value.registry[storeName]) {
        return storeError('DUPLICATE_STORE_NAME', `Duplicate store name: ${storeName}.`, {
            line,
            store: storeName,
        });
    }
    return ok({
        ...finalized.value,
        mode: nextMode,
        currentStore: { name: storeName, indent, line },
        hasStoreEntries: true,
    });
};

const handlePathValue = (
    state: RegistryState,
    pathValue: string,
    indent: number,
    line: number,
): StoreResult<RegistryState, StoreRegistryParseError> => {
    if (!state.currentStore) {
        if (state.mode === 'unknown') {
            return storeError(
                'MISSING_STORES_SECTION',
                "Registry must start with a store entry or a 'stores:' section.",
                { line },
            );
        }
        return storeError('UNEXPECTED_ENTRY', 'Path entry must belong to a store definition.', {
            line,
        });
    }
    if (indent <= state.currentStore.indent) {
        return storeError(
            'INVALID_STORE_PATH',
            'Store path must be indented under the store name.',
            {
                line,
                store: state.currentStore.name,
            },
        );
    }
    if (state.currentStore.path) {
        return storeError('INVALID_STORE_PATH', 'Store path is already defined.', {
            line,
            store: state.currentStore.name,
        });
    }
    const parsedPath = parsePathValue(pathValue);
    if (!parsedPath) {
        return storeError('INVALID_STORE_PATH', 'Store path must be a non-empty string.', {
            line,
            store: state.currentStore.name,
        });
    }
    return ok({
        ...state,
        registry: {
            ...state.registry,
            [state.currentStore.name]: {
                path: parsedPath,
                ...(state.currentStore.description !== undefined && {
                    description: state.currentStore.description,
                }),
            },
        },
        currentStore: { ...state.currentStore, path: parsedPath },
    });
};

const handleDescriptionValue = (
    state: RegistryState,
    descValue: string,
    indent: number,
    line: number,
): StoreResult<RegistryState, StoreRegistryParseError> => {
    if (!state.currentStore) {
        return storeError(
            'UNEXPECTED_ENTRY',
            'Description entry must belong to a store definition.',
            {
                line,
            },
        );
    }
    if (indent <= state.currentStore.indent) {
        return storeError(
            'UNEXPECTED_ENTRY',
            'Store description must be indented under the store name.',
            {
                line,
                store: state.currentStore.name,
            },
        );
    }
    if (state.currentStore.description !== undefined) {
        return storeError('UNEXPECTED_ENTRY', 'Store description is already defined.', {
            line,
            store: state.currentStore.name,
        });
    }
    const parsedDesc = parsePathValue(descValue); // Reuse parsePathValue for string parsing
    // Description can be empty string (unlike path)
    return ok({
        ...state,
        currentStore: { ...state.currentStore, description: parsedDesc },
    });
};

const handleStoresSection = (
    state: RegistryState,
    rawLine: string,
    line: number,
): StoreResult<{ handled: boolean; state: RegistryState }, StoreRegistryParseError> => {
    if (state.mode !== 'unknown') {
        return ok({ handled: false, state });
    }
    const match = /^(\s*)stores\s*:\s*$/.exec(rawLine);
    if (!match) {
        return ok({ handled: false, state });
    }
    const indent = match[1]?.length ?? 0;
    if (indent !== 0) {
        return storeError('INVALID_STORES_SECTION', "'stores:' section must be at the top level.", {
            line,
        });
    }
    return ok({
        handled: true,
        state: { ...state, mode: 'stores', storesIndent: indent },
    });
};

const readRegistryLine = (
    rawLine: string,
    lineNumber: number,
    state: RegistryState,
): StoreResult<RegistryState, StoreRegistryParseError> => {
    const storesResult = handleStoresSection(state, rawLine, lineNumber);
    if (!storesResult.ok()) {
        return storesResult;
    }
    if (storesResult.value.handled) {
        return ok(storesResult.value.state);
    }

    const { indent, content } = parseIndent(rawLine);
    const storeName = isStoreHeader(content);
    if (storeName) {
        return handleStoreHeader(state, storeName, indent, lineNumber);
    }

    const pathValue = isPathEntry(content);
    if (pathValue !== null) {
        return handlePathValue(state, pathValue, indent, lineNumber);
    }

    const descValue = isDescriptionEntry(content);
    if (descValue !== null) {
        return handleDescriptionValue(state, descValue, indent, lineNumber);
    }

    if (state.mode === 'unknown') {
        return storeError(
            'MISSING_STORES_SECTION',
            "Registry must start with a store entry or a 'stores:' section.",
            { line: lineNumber },
        );
    }

    return storeError('UNEXPECTED_ENTRY', 'Unexpected registry entry.', { line: lineNumber });
};

export const parseStoreRegistry = (
    raw: string,
): StoreResult<Registry, StoreRegistryParseError> => {
    const normalized = raw.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');

    let state: RegistryState = {
        mode: 'unknown',
        storesIndent: 0,
        currentStore: null,
        hasStoreEntries: false,
        registry: {},
    };

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
        const nextState = readRegistryLine(rawLine, lineNumber, state);
        if (!nextState.ok()) {
            return nextState;
        }
        state = nextState.value;
    }

    if (!state.hasStoreEntries) {
        return storeError(
            'MISSING_STORES_SECTION',
            'Registry must include at least one store entry.',
            { line: 1 },
        );
    }

    const finalizeResult = finalizeStore(state);
    if (!finalizeResult.ok()) {
        return finalizeResult;
    }

    return ok(finalizeResult.value.registry);
};

export type StoreRegistryLoadErrorCode =
    | 'REGISTRY_READ_FAILED'
    | 'REGISTRY_PARSE_FAILED'
    | 'REGISTRY_MISSING';

export interface StoreRegistryLoadError {
    code: StoreRegistryLoadErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
}

export type StoreRegistrySaveErrorCode = 'REGISTRY_WRITE_FAILED' | 'REGISTRY_SERIALIZE_FAILED';

export interface StoreRegistrySaveError {
    code: StoreRegistrySaveErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
}

export type StoreRegistrySerializeErrorCode =
    | 'INVALID_STORE_NAME'
    | 'INVALID_STORE_PATH'
    | 'EMPTY_REGISTRY';

export interface StoreRegistrySerializeError {
    code: StoreRegistrySerializeErrorCode;
    message: string;
    store?: string;
}

const formatYamlScalar = (value: string): string => JSON.stringify(value);

export const serializeStoreRegistry = (registry: Registry): SerializeRegistryResult => {
    const entries = Object.entries(registry).sort(([left], [right]) => left.localeCompare(right));
    if (entries.length === 0) {
        return storeError('EMPTY_REGISTRY', 'Store registry must include at least one store.');
    }

    const lines: string[] = ['stores:'];
    for (const [
        name, definition,
    ] of entries) {
        if (!isValidStoreName(name)) {
            return storeError('INVALID_STORE_NAME', 'Store name must be a lowercase slug.', {
                store: name,
            });
        }
        const path = definition.path?.trim() ?? '';
        if (!path) {
            return storeError('INVALID_STORE_PATH', 'Store path must be a non-empty string.', {
                store: name,
            });
        }
        lines.push(`  ${name}:`);
        lines.push(`    path: ${formatYamlScalar(path)}`);
        if (definition.description !== undefined) {
            lines.push(`    description: ${formatYamlScalar(definition.description)}`);
        }
    }

    return ok(lines.join('\n'));
};

// ---------------------------------------------------------------------------
// Store Resolution
// ---------------------------------------------------------------------------

export type StoreResolveErrorCode = 'STORE_NOT_FOUND';

export interface StoreResolveError {
    code: StoreResolveErrorCode;
    message: string;
    store: string;
}

/**
 * Resolves a store name to its filesystem path using the registry.
 *
 * Looks up the store name in the provided registry and returns its
 * configured path. Returns an error if the store is not registered.
 *
 * @param registry - The store registry to search
 * @param storeName - The store name to resolve
 * @returns Result with the store path or error
 *
 * @example
 * ```ts
 * const registry = { default: { path: '/path/to/default' } };
 * const result = resolveStorePath(registry, 'default');
 * if (result.ok()) {
 *   console.log(result.value); // '/path/to/default'
 * }
 * ```
 */
export const resolveStorePath = (
    registry: Registry,
    storeName: string,
): StoreResult<string, StoreResolveError> => {
    const definition = registry[storeName];
    if (!definition) {
        return storeError(
            'STORE_NOT_FOUND',
            `Store '${storeName}' is not registered. Use 'cortex store list' to see available stores.`,
            { store: storeName },
        ) as StoreResult<string, StoreResolveError>;
    }
    return ok(definition.path);
};
