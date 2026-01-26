/**
 * Index parsing and serialization helpers
 */

import type {
    CategoryIndex,
    IndexMemoryEntry,
    IndexParseError,
    IndexSerializeError,
    IndexSubcategoryEntry,
} from './types.ts';
import type { Result } from '../types.ts';

type IndexLineResult = Result<string[], IndexSerializeError>;
type IndexSerializeResult = Result<string, IndexSerializeError>;

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

type Section = 'memories' | 'subcategories';

const parseNumber = (
    value: string,
    field: string,
    line: number,
): Result<number, IndexParseError> => {
    const trimmed = value.trim();
    if (!trimmed) {
        return err({
            code: 'MISSING_FIELD',
            message: `Missing ${field} value.`,
            field,
            line,
        });
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
        return err({
            code: 'INVALID_NUMBER',
            message: `Invalid ${field} value.`,
            field,
            line,
        });
    }
    if (parsed < 0) {
        return err({
            code: 'INVALID_NUMBER',
            message: `Invalid ${field} value.`,
            field,
            line,
        });
    }
    return ok(parsed);
};

const parseEntryLine = (
    line: string,
    lineNumber: number,
): Result<{ key: string; value: string }, IndexParseError> => {
    const match = /^\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(line);
    if (!match || !match[1]) {
        return err({
            code: 'INVALID_ENTRY',
            message: 'Invalid index entry.',
            line: lineNumber,
        });
    }
    return ok({ key: match[1], value: match[2] ?? '' });
};

const parsePathValue = (
    value: string, line: number,
): Result<string, IndexParseError> => {
    const trimmed = value.trim();
    if (trimmed) {
        return ok(trimmed);
    }
    return err({
        code: 'MISSING_FIELD',
        message: 'Missing path value.',
        field: 'path',
        line,
    });
};

const parseEntryLineValue = (
    rawLine: string,
    lineNumber: number,
): Result<{ key: string; value: string }, IndexParseError> => parseEntryLine(
    rawLine, lineNumber,
);

const parseTokenEstimate = (
    value: string, line: number,
): Result<number, IndexParseError> =>
    parseNumber(
        value, 'token_estimate', line,
    );

const parseMemoryCount = (
    value: string, line: number,
): Result<number, IndexParseError> =>
    parseNumber(
        value, 'memory_count', line,
    );

const isIndentedEntryLine = (line: string): boolean => {
    const indentMatch = /^(\s*)/.exec(line);
    const indent = indentMatch?.[1]?.length ?? 0;
    return indent >= 4;
};

const parseEntryKeyValue = (
    line: string,
    lineNumber: number,
): Result<{ key: string; value: string }, IndexParseError> => parseEntryLineValue(
    line, lineNumber,
);

interface EntryState {
    path?: string;
    tokenEstimate?: number;
    summary?: string;
    memoryCount?: number;
}

type EntryHandler = (
    state: EntryState,
    value: string,
    lineNumber: number,
) => Result<void, IndexParseError>;

const entryHandlers: Record<string, { section?: Section; apply: EntryHandler }> = {
    path: {
        apply: (
            state, value, lineNumber,
        ) => {
            const parsedPath = parsePathValue(
                value, lineNumber,
            );
            if (!parsedPath.ok) {
                return parsedPath;
            }
            state.path = parsedPath.value;
            return ok(undefined);
        },
    },
    token_estimate: {
        section: 'memories',
        apply: (
            state, value, lineNumber,
        ) => {
            const parsedNumber = parseTokenEstimate(
                value, lineNumber,
            );
            if (!parsedNumber.ok) {
                return parsedNumber;
            }
            state.tokenEstimate = parsedNumber.value;
            return ok(undefined);
        },
    },
    summary: {
        section: 'memories',
        apply: (
            state, value,
        ) => {
            state.summary = value.trim();
            return ok(undefined);
        },
    },
    memory_count: {
        section: 'subcategories',
        apply: (
            state, value, lineNumber,
        ) => {
            const parsedNumber = parseMemoryCount(
                value, lineNumber,
            );
            if (!parsedNumber.ok) {
                return parsedNumber;
            }
            state.memoryCount = parsedNumber.value;
            return ok(undefined);
        },
    },
};

const applyEntryKey = (
    state: EntryState,
    section: Section,
    key: string,
    value: string,
    lineNumber: number,
): Result<void, IndexParseError> => {
    const handler = entryHandlers[key];
    if (!handler) {
        return err({
            code: 'INVALID_ENTRY',
            message: `Unexpected index field: ${key}.`,
            field: key,
            line: lineNumber,
        });
    }
    if (handler.section && handler.section !== section) {
        return err({
            code: 'INVALID_ENTRY',
            message: `Unexpected ${key} in ${section} section.`,
            field: key,
            line: lineNumber,
        });
    }
    return handler.apply(
        state, value, lineNumber,
    );
};

const finalizeEntry = (
    state: EntryState,
    section: Section,
    entryLine: number,
    nextIndex: number,
): Result<
    { entry: IndexMemoryEntry | IndexSubcategoryEntry; nextIndex: number },
    IndexParseError
> => {
    if (!state.path) {
        return err({
            code: 'MISSING_FIELD',
            message: 'Missing path value.',
            field: 'path',
            line: entryLine,
        });
    }
    if (section === 'memories') {
        if (state.tokenEstimate === undefined) {
            return err({
                code: 'MISSING_FIELD',
                message: 'Missing token_estimate value.',
                field: 'token_estimate',
                line: entryLine,
            });
        }
        return ok({
            entry: { path: state.path, tokenEstimate: state.tokenEstimate, summary: state.summary },
            nextIndex,
        });
    }
    if (state.memoryCount === undefined) {
        return err({
            code: 'MISSING_FIELD',
            message: 'Missing memory_count value.',
            field: 'memory_count',
            line: entryLine,
        });
    }
    return ok({ entry: { path: state.path, memoryCount: state.memoryCount }, nextIndex });
};

const parseEntry = (
    lines: string[],
    startIndex: number,
    lineOffset: number,
    section: Section,
): Result<
    { entry: IndexMemoryEntry | IndexSubcategoryEntry; nextIndex: number },
    IndexParseError
> => {
    const state: EntryState = {};
    let index = startIndex;
    const entryLine = startIndex + lineOffset - 1;

    while (index < lines.length) {
        const rawLine = lines[index];
        if (rawLine === undefined) {
            break;
        }
        if (!rawLine.trim()) {
            index += 1;
            continue;
        }
        if (!isIndentedEntryLine(rawLine)) {
            break;
        }

        const parsedLine = parseEntryKeyValue(
            rawLine, index + lineOffset,
        );
        if (!parsedLine.ok) {
            return parsedLine;
        }
        const applied = applyEntryKey(
            state,
            section,
            parsedLine.value.key,
            parsedLine.value.value,
            index + lineOffset,
        );
        if (!applied.ok) {
            return applied;
        }
        index += 1;
    }

    return finalizeEntry(
        state, section, entryLine, index,
    );
};

const parseSectionHeader = (
    line: string, section: Section,
): Result<boolean, IndexParseError> => {
    if (line === `${section}:`) {
        return ok(true);
    }
    const emptyMatch = new RegExp(`^${section}:\\s*\\[\\s*\\]\\s*$`).exec(line);
    if (emptyMatch) {
        return ok(true);
    }
    return ok(false);
};

const pushParsedEntry = (
    section: Section,
    entry: IndexMemoryEntry | IndexSubcategoryEntry,
    memories: IndexMemoryEntry[],
    subcategories: IndexSubcategoryEntry[],
): void => {
    if (section === 'memories') {
        memories.push(entry as IndexMemoryEntry);
        return;
    }
    subcategories.push(entry as IndexSubcategoryEntry);
};

const parseIndexEntry = (
    lines: string[],
    index: number,
    section: Section,
): Result<
    { entry: IndexMemoryEntry | IndexSubcategoryEntry; nextIndex: number },
    IndexParseError
> => parseEntry(
    lines, index + 1, 1, section,
);

const serializeMemoryEntry = (entry: IndexMemoryEntry): Result<string[], IndexSerializeError> => {
    if (!entry.path?.trim()) {
        return err({
            code: 'INVALID_ENTRY',
            message: 'Memory entry path must be provided.',
            field: 'path',
        });
    }
    const parsedToken = serializeNumber(
        entry.tokenEstimate, 'token_estimate',
    );
    if (!parsedToken.ok) {
        return parsedToken;
    }
    const lines = [
        '  -',
        `    path: ${entry.path.trim()}`,
        `    token_estimate: ${parsedToken.value}`,
    ];
    if (entry.summary?.trim()) {
        lines.push(`    summary: ${entry.summary.trim()}`);
    }
    return ok(lines);
};

const serializeSubcategoryEntry = (entry: IndexSubcategoryEntry): IndexLineResult => {
    if (!entry.path?.trim()) {
        return err({
            code: 'INVALID_ENTRY',
            message: 'Subcategory entry path must be provided.',
            field: 'path',
        });
    }
    const parsedCount = serializeNumber(
        entry.memoryCount, 'memory_count',
    );
    if (!parsedCount.ok) {
        return parsedCount;
    }
    return ok([
        '  -',
        `    path: ${entry.path.trim()}`,
        `    memory_count: ${parsedCount.value}`,
    ]);
};

const resolveSection = (line: string): Result<Section | null, IndexParseError> => {
    const memoriesHeader = parseSectionHeader(
        line, 'memories',
    );
    if (!memoriesHeader.ok) {
        return memoriesHeader;
    }
    if (memoriesHeader.value) {
        return ok('memories');
    }
    const subcategoriesHeader = parseSectionHeader(
        line, 'subcategories',
    );
    if (!subcategoriesHeader.ok) {
        return subcategoriesHeader;
    }
    if (subcategoriesHeader.value) {
        return ok('subcategories');
    }
    return ok(null);
};

export const parseCategoryIndex = (raw: string): Result<CategoryIndex, IndexParseError> => {
    const normalized = raw.replace(
        /\r\n/g, '\n',
    );
    const lines = normalized.split('\n');
    const memories: IndexMemoryEntry[] = [];
    const subcategories: IndexSubcategoryEntry[] = [];
    let section: Section | null = null;
    let index = 0;

    while (index < lines.length) {
        const rawLine = lines[index];
        if (rawLine === undefined) {
            break;
        }
        const line = rawLine.trim();
        const lineNumber = index + 1;

        if (!line || line.startsWith('#')) {
            index += 1;
            continue;
        }

        const sectionResult = resolveSection(line);
        if (!sectionResult.ok) {
            return sectionResult;
        }
        if (sectionResult.value) {
            section = sectionResult.value;
            index += 1;
            continue;
        }

        if (!section) {
            return err({
                code: 'INVALID_SECTION',
                message: 'Index entries must be under a section.',
                line: lineNumber,
            });
        }

        const listMatch = /^\s*-\s*$/.exec(rawLine);
        if (!listMatch) {
            return err({
                code: 'INVALID_FORMAT',
                message: "Index entries must start with '-' list markers.",
                line: lineNumber,
            });
        }

        const parsedEntry = parseIndexEntry(
            lines, index, section,
        );
        if (!parsedEntry.ok) {
            return parsedEntry;
        }

        pushParsedEntry(
            section, parsedEntry.value.entry, memories, subcategories,
        );

        index = parsedEntry.value.nextIndex;
    }

    return ok({ memories, subcategories });
};

const serializeNumber = (
    value: number, field: string,
): Result<number, IndexSerializeError> => {
    if (!Number.isFinite(value)) {
        return err({
            code: 'INVALID_NUMBER',
            message: `Invalid ${field} value.`,
            field,
        });
    }
    if (value < 0) {
        return err({
            code: 'INVALID_NUMBER',
            message: `Invalid ${field} value.`,
            field,
        });
    }
    return ok(value);
};

export const serializeCategoryIndex = (index: CategoryIndex): IndexSerializeResult => {
    const memories: string[] = [];
    if (index.memories.length === 0) {
        memories.push('memories: []');
    }
    else {
        memories.push('memories:');
        for (const entry of index.memories) {
            const serialized = serializeMemoryEntry(entry);
            if (!serialized.ok) {
                return serialized;
            }
            memories.push(...serialized.value);
        }
    }

    const subcategories: string[] = [];
    if (index.subcategories.length === 0) {
        subcategories.push('subcategories: []');
    }
    else {
        subcategories.push('subcategories:');
        for (const entry of index.subcategories) {
            const serialized = serializeSubcategoryEntry(entry);
            if (!serialized.ok) {
                return serialized;
            }
            subcategories.push(...serialized.value);
        }
    }

    return ok([
        ...memories,
        '',
        ...subcategories,
    ].join('\n'));
};
