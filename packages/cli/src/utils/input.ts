/**
 * CLI helpers for resolving memory content input.
 */

import { readFile } from 'node:fs/promises';
import { err, ok, type Result } from '@yeseh/cortex-core';

export type MemoryContentSource = 'flag' | 'file' | 'stdin' | 'none';

export type InputSource = {
    content?: string;
    filePath?: string;
    /**
     * stdin stream to read from.
     *
     * NOTE: Passing a stream does not necessarily mean stdin is intended as an input
     * source. Use `stdinRequested: true` when a command semantics include reading from
     * stdin by default (e.g. `memory add`), typically when piping.
     */
    stream?: NodeJS.ReadableStream;
    /**
     * Explicitly indicates stdin should be considered as an input source.
     *
     * This is `false` by default so that inheriting a non-TTY stdin in test harnesses
     * or subprocess environments does not accidentally count as providing `--stdin`.
     */
    stdinRequested?: boolean;
};

export interface InputContent {
    content: string | null;
    source: MemoryContentSource;
}

export type InputErrorCode =
    | 'MULTIPLE_CONTENT_SOURCES'
    | 'FILE_READ_FAILED'
    | 'MISSING_CONTENT'
    | 'INVALID_FILE_PATH';

export interface InputError {
    code: InputErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
}

type InputResult = Result<InputContent, InputError>;
type OptionalContentResult = Result<InputContent | null, InputError>;

export const readContentFromFile = async (
    filePath: string | undefined
): Promise<OptionalContentResult> => {
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

export const readContentFromStream = async (
    stream: NodeJS.ReadableStream
): Promise<OptionalContentResult> => {
    const isTty = 'isTTY' in stream ? Boolean(stream.isTTY) : false;
    if (isTty) {
        return ok(null);
    }

    if ('setEncoding' in stream && typeof stream.setEncoding === 'function') {
        stream.setEncoding('utf8');
    }

    let data = '';
    for await (const chunk of stream) {
        data += String(chunk);
    }

    return ok({ content: data, source: 'stdin' });
};

/*
 * Main function to resolve content input from various sources.
 */
export const resolveInput = async (source: InputSource): Promise<InputResult> => {
    const contentProvided = source.content !== undefined;
    const fileProvided = source.filePath !== undefined && source.filePath.trim() !== '';

    // stdin must be explicitly requested by the caller. Merely having a stream
    // attached (e.g. inherited stdin in a subprocess) should not count as providing
    // an input source.
    const streamRequested =
        source.stdinRequested === true &&
        source.stream !== null &&
        source.stream !== undefined &&
        !('isTTY' in source.stream && Boolean((source.stream as { isTTY?: boolean }).isTTY));

    const requestedSources = [contentProvided, fileProvided, streamRequested].filter(Boolean);

    if (requestedSources.length > 1) {
        return err({
            code: 'MULTIPLE_CONTENT_SOURCES',
            message: 'Provide either --content, --file, or --stdin, not multiple sources.',
        });
    }

    if (contentProvided) {
        return ok({ content: source.content ?? '', source: 'flag' });
    }

    const fileResult = await readContentFromFile(source.filePath);
    if (!fileResult.ok()) {
        return fileResult;
    }
    if (fileResult.value) {
        return ok(fileResult.value);
    }

    if (streamRequested) {
        const stdinResult = await readContentFromStream(source.stream!);
        if (!stdinResult.ok()) {
            return stdinResult;
        }
        if (stdinResult.value) {
            return ok(stdinResult.value);
        }
    }

    return ok({ content: null, source: 'none' });
};
