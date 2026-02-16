/**
 * CLI helpers for resolving memory content input.
 */

import { readFile } from 'node:fs/promises';
import { err, ok, type Result } from '@yeseh/cortex-core';

export type MemoryContentSource = 'flag' | 'file' | 'stdin' | 'none';

export interface MemoryContentInputOptions {
    content?: string;
    filePath?: string;
    stdin?: NodeJS.ReadableStream;
    stdinRequested?: boolean;
    requireStdinFlag?: boolean;
    requireContent?: boolean;
}

export interface MemoryContentInputResult {
    content: string | null;
    source: MemoryContentSource;
}

export type MemoryContentInputErrorCode =
    | 'MULTIPLE_CONTENT_SOURCES'
    | 'FILE_READ_FAILED'
    | 'MISSING_CONTENT'
    | 'INVALID_FILE_PATH';

export interface MemoryContentInputError {
    code: MemoryContentInputErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
}

type ContentInputResult = Result<MemoryContentInputResult, MemoryContentInputError>;
type OptionalContentResult = Result<MemoryContentInputResult | null, MemoryContentInputError>;

const readStdin = async (stdin: NodeJS.ReadableStream): Promise<string> => {
    if ('setEncoding' in stdin && typeof stdin.setEncoding === 'function') {
        stdin.setEncoding('utf8');
    }
    let data = '';
    for await (const chunk of stdin) {
        data += String(chunk);
    }
    return data;
};

const resolveFileContent = async (filePath: string | undefined): Promise<OptionalContentResult> => {
    if (filePath === undefined) {
        return ok(null);
    }
    const trimmed = filePath.trim();
    if (!trimmed) {
        return err({
            code: 'INVALID_FILE_PATH',
            message: 'File path must be a non-empty string.',
        });
    }
    try {
        const content = await readFile(trimmed, 'utf8');
        return ok({ content, source: 'file' });
    } catch (error) {
        return err({
            code: 'FILE_READ_FAILED',
            message: `Failed to read content file: ${trimmed}.`,
            path: trimmed,
            cause: error,
        });
    }
};

const resolveStdinContent = async (
    stdin?: NodeJS.ReadableStream
): Promise<OptionalContentResult> => {
    const stream = stdin ?? process.stdin;
    const isTty = 'isTTY' in stream ? Boolean(stream.isTTY) : false;
    if (isTty) {
        return ok(null);
    }
    const content = await readStdin(stream);
    return ok({ content, source: 'stdin' });
};

export const resolveMemoryContentInput = async (
    options: MemoryContentInputOptions
): Promise<ContentInputResult> => {
    const contentProvided = options.content !== undefined;
    const fileProvided = options.filePath !== undefined;
    const stdinRequested = options.stdinRequested === true;
    const requireStdinFlag = options.requireStdinFlag === true;

    const requestedSources = [contentProvided, fileProvided, stdinRequested].filter(Boolean);
    if (requestedSources.length > 1) {
        return err({
            code: 'MULTIPLE_CONTENT_SOURCES',
            message: 'Provide either --content, --file, or --stdin, not multiple sources.',
        });
    }

    if (contentProvided) {
        return ok({ content: options.content ?? '', source: 'flag' });
    }

    const fileResult = await resolveFileContent(options.filePath);
    if (!fileResult.ok()) {
        return fileResult;
    }
    if (fileResult.value) {
        return ok(fileResult.value);
    }

    if (!requireStdinFlag || stdinRequested) {
        const stdinResult = await resolveStdinContent(options.stdin);
        if (!stdinResult.ok()) {
            return stdinResult;
        }
        if (stdinResult.value) {
            return ok(stdinResult.value);
        }
    }

    if (options.requireContent) {
        return err({
            code: 'MISSING_CONTENT',
            message: 'Content is required via --content, --file, or stdin.',
        });
    }

    return ok({ content: null, source: 'none' });
};
