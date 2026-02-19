/**
 * CLI helpers for resolving memory content input.
 */

import { readFile } from 'node:fs/promises';
import { err, ok, type Result } from '@yeseh/cortex-core';

export type MemoryContentSource = 'flag' | 'file' | 'stdin' | 'none';

export type InputSource = {
    content?: string;
    filePath?: string;
    stream?: NodeJS.ReadableStream;
}

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

export const readContentFromFile = async (filePath: string | undefined)
    : Promise<OptionalContentResult> => {

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
        const content = await readFile(
            trimmed, 'utf8',
        );
        return ok({ content, source: 'file' });
    }
    catch (error) {
        return err({
            code: 'FILE_READ_FAILED',
            message: `Failed to read content file: ${trimmed}.`,
            path: trimmed,
            cause: error,
        });
    }
};

export const readContentFromStream = async(stream: NodeJS.ReadableStream) 
    : Promise<OptionalContentResult> => {

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
export const resolveInput = async (source: InputSource)
    : Promise<InputResult> => {

    const contentProvided = source.content !== undefined 
        && source.content.trim() !== '';
    const fileProvided = source.filePath !== undefined 
        && source.filePath.trim() !== '';
    const streamRequested = source.stream !== null 
        && source.stream !== undefined;

    const requestedSources = [
        contentProvided,
        fileProvided,
        streamRequested,
    ].filter(Boolean);

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
