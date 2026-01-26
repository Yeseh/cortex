/**
 * CLI add command parsing for memory content input.
 */

import type { Result } from '../../core/result.ts';
import { ok, err } from '../../core/result.ts';

import { serializeMemoryFile, type MemoryFileContents } from '../../core/memory/file.ts';
import { validateMemorySlugPath } from '../../core/memory/validation.ts';
import type { StorageAdapterError } from '../../core/storage/adapter.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem.ts';

import type { MemoryContentInputError } from '../input.ts';
import { resolveMemoryContentInput } from '../input.ts';

export interface AddCommandOptions {
    storeRoot: string;
    args: string[];
    stdin?: NodeJS.ReadableStream;
    now?: Date;
}

export interface AddCommandOutput {
    message: string;
}

export interface AddCommandError {
    code:
        | 'INVALID_ARGUMENTS'
        | 'CONTENT_INPUT_FAILED'
        | 'INVALID_PATH'
        | 'SERIALIZE_FAILED'
        | 'WRITE_FAILED';
    message: string;
    field?: string;
    cause?: MemoryContentInputError | StorageAdapterError | unknown;
}

type AddCommandResult = Result<AddCommandOutput, AddCommandError>;


interface ParsedAddArgs {
    slugPath: string;
    content?: string;
    filePath?: string;
    tags: string[];
    expiresAt?: Date;
}

const parseTagsValue = (raw: string): Result<string[], AddCommandError> => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return ok([]);
    }
    const parts = trimmed.split(',');
    const tags = parts.map((part) => part.trim());
    if (tags.every((tag) => tag.length === 0)) {
        return ok([]);
    }
    for (const tag of tags) {
        if (!tag) {
            return err({
                code: 'INVALID_ARGUMENTS',
                message: 'Tags must be non-empty strings.',
                field: 'tags',
            });
        }
    }
    return ok(tags);
};

const parseExpiresAtValue = (raw: string): Result<Date, AddCommandError> => {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return err({
            code: 'INVALID_ARGUMENTS',
            message: 'Expiry must be a valid ISO timestamp.',
            field: 'expires_at',
        });
    }
    return ok(parsed);
};

const parseFlagValue = (
    args: string[],
    index: number,
    flag: string,
    field: AddCommandError['field'],
): Result<{ value: string; nextIndex: number }, AddCommandError> => {
    const candidate = args[index + 1];
    if (candidate === undefined) {
        return err({
            code: 'INVALID_ARGUMENTS',
            message: `${flag} requires a value.`,
            field,
        });
    }
    return ok({ value: candidate, nextIndex: index + 1 });
};

type AddArgResult = { kind: 'skip' } | { kind: 'set'; nextIndex: number };

type FlagHandler = (state: ParsedAddArgs, value: string) => void;

const applyFlagValue = (
    state: ParsedAddArgs,
    args: string[],
    index: number,
    flag: string,
    field: AddCommandError['field'],
    handler: FlagHandler,
): Result<AddArgResult, AddCommandError> => {
    const parsed = parseFlagValue(
        args, index, flag, field,
    );
    if (!parsed.ok) {
        return parsed;
    }
    handler(
        state, parsed.value.value,
    );
    return ok({ kind: 'set', nextIndex: parsed.value.nextIndex });
};

type FlagHandlerFn = (
    state: ParsedAddArgs,
    args: string[],
    index: number,
) => Result<AddArgResult, AddCommandError>;

const addFlagHandlers: Record<string, FlagHandlerFn> = {
    '--content': (
        state, args, index,
    ) =>
        applyFlagValue(
            state, args, index, '--content', 'content', (
                target, next,
            ) => {
                target.content = next;
            },
        ),
    '--file': (
        state, args, index,
    ) =>
        applyFlagValue(
            state, args, index, '--file', 'file', (
                target, next,
            ) => {
                target.filePath = next;
            },
        ),
    '--tags': (
        state, args, index,
    ) => {
        const parsed = parseFlagValue(
            args, index, '--tags', 'tags',
        );
        if (!parsed.ok) {
            return parsed;
        }
        const tagsResult = parseTagsValue(parsed.value.value);
        if (!tagsResult.ok) {
            return tagsResult;
        }
        state.tags = tagsResult.value;
        return ok({ kind: 'set', nextIndex: parsed.value.nextIndex });
    },
    '--expires-at': (
        state, args, index,
    ) => {
        const parsed = parseFlagValue(
            args, index, '--expires-at', 'expires_at',
        );
        if (!parsed.ok) {
            return parsed;
        }
        const expiresResult = parseExpiresAtValue(parsed.value.value);
        if (!expiresResult.ok) {
            return expiresResult;
        }
        state.expiresAt = expiresResult.value;
        return ok({ kind: 'set', nextIndex: parsed.value.nextIndex });
    },
};

const applyAddArg = (
    state: ParsedAddArgs,
    args: string[],
    index: number,
    value: string,
): Result<AddArgResult, AddCommandError> => {
    const handler = addFlagHandlers[value];
    if (handler) {
        return handler(
            state, args, index,
        );
    }
    if (value.startsWith('-')) {
        return err({
            code: 'INVALID_ARGUMENTS',
            message: `Unknown flag: ${value}.`,
        });
    }
    if (!state.slugPath) {
        state.slugPath = value;
        return ok({ kind: 'skip' });
    }
    return err({
        code: 'INVALID_ARGUMENTS',
        message: 'Too many positional arguments for add command.',
    });
};

const parseAddArgs = (args: string[]): Result<ParsedAddArgs, AddCommandError> => {
    const state: ParsedAddArgs = { slugPath: '', tags: [] };

    for (let index = 0; index < args.length; index += 1) {
        const value = args[index];
        if (!value) {
            continue;
        }
        const applied = applyAddArg(
            state, args, index, value,
        );
        if (!applied.ok) {
            return applied;
        }
        if (applied.value.kind === 'set') {
            index = applied.value.nextIndex;
        }
    }

    if (!state.slugPath) {
        return err({
            code: 'INVALID_ARGUMENTS',
            message: 'Memory path is required for add command.',
        });
    }

    return ok(state);
};

export const runAddCommand = async (options: AddCommandOptions): Promise<AddCommandResult> => {
    const parsed = parseAddArgs(options.args);
    if (!parsed.ok) {
        return parsed;
    }

    const identity = validateMemorySlugPath(parsed.value.slugPath);
    if (!identity.ok) {
        return err({
            code: 'INVALID_PATH',
            message: identity.error.message,
            cause: identity.error,
        });
    }

    const contentResult = await resolveMemoryContentInput({
        content: parsed.value.content,
        filePath: parsed.value.filePath,
        stdin: options.stdin,
        requireStdinFlag: false,
        requireContent: true,
    });
    if (!contentResult.ok) {
        return err({
            code: 'CONTENT_INPUT_FAILED',
            message: contentResult.error.message,
            cause: contentResult.error,
        });
    }

    const now = options.now ?? new Date();
    const memoryContents: MemoryFileContents = {
        frontmatter: {
            createdAt: now,
            updatedAt: now,
            tags: parsed.value.tags,
            source: contentResult.value.source,
            expiresAt: parsed.value.expiresAt,
        },
        content: contentResult.value.content ?? '',
    };
    const serialized = serializeMemoryFile(memoryContents);
    if (!serialized.ok) {
        return err({
            code: 'SERIALIZE_FAILED',
            message: serialized.error.message,
            cause: serialized.error,
        });
    }

    const adapter = new FilesystemStorageAdapter({ rootDirectory: options.storeRoot });
    const persisted = await adapter.writeMemoryFile(
        identity.value.slugPath, serialized.value, {
            allowIndexCreate: true,
            allowIndexUpdate: true,
        },
    );
    if (!persisted.ok) {
        return err({
            code: 'WRITE_FAILED',
            message: persisted.error.message,
            cause: persisted.error,
        });
    }

    return ok({
        message: `Added memory ${identity.value.slugPath} (${contentResult.value.source}).`,
    });
};
