import { describe, expect, it } from 'bun:test';
import { CommanderError, InvalidArgumentError } from '@commander-js/extra-typings';

import { throwCoreError, type CoreError } from './errors.ts';

describe('mapCoreError', () => {
    describe('argument error codes', () => {
        const argumentErrorCodes = [
            'INVALID_PATH',
            'INVALID_FILE_PATH',
            'INVALID_SOURCE_PATH',
            'INVALID_DESTINATION_PATH',
            'INVALID_ARGUMENTS',
            'INVALID_STORE_NAME',
            'INVALID_STORE_PATH',
            'MISSING_CONTENT',
            'MULTIPLE_CONTENT_SOURCES',
            'CONTENT_INPUT_FAILED',
            'INVALID_COMMAND',
            'GIT_REPO_REQUIRED',
        ];

        it.each(argumentErrorCodes)('should throw InvalidArgumentError for %s', (code) => {
            const error: CoreError = {
                code,
                message: `Test message for ${code}`,
            };

            expect(() => throwCoreError(error)).toThrow(InvalidArgumentError);
        });

        it('should preserve error message in InvalidArgumentError', () => {
            const error: CoreError = {
                code: 'INVALID_PATH',
                message: 'Path must not be empty',
            };

            try {
                throwCoreError(error);
                expect.unreachable('mapCoreError should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(InvalidArgumentError);
                expect((e as InvalidArgumentError).message).toBe('Path must not be empty');
            }
        });

        it('should handle empty message for argument errors', () => {
            const error: CoreError = {
                code: 'MISSING_CONTENT',
                message: '',
            };

            try {
                throwCoreError(error);
                expect.unreachable('mapCoreError should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(InvalidArgumentError);
                expect((e as InvalidArgumentError).message).toBe('');
            }
        });
    });

    describe('non-argument error codes', () => {
        const nonArgumentErrorCodes = [
            'MEMORY_NOT_FOUND',
            'STORE_NOT_FOUND',
            'FILE_READ_FAILED',
            'CATEGORY_NOT_FOUND',
            'INTERNAL_ERROR',
            'UNKNOWN_ERROR',
            'SERIALIZE_FAILED',
            'STORE_INIT_FAILED',
            'STORE_REGISTRY_FAILED',
            'STORE_ALREADY_EXISTS',
            'STORAGE_ERROR',
            'IO_READ_ERROR',
            'IO_WRITE_ERROR',
            'PARSE_FAILED',
            'MOVE_FAILED',
            'REMOVE_FAILED',
            'REINDEX_FAILED',
        ];

        it.each(nonArgumentErrorCodes)('should throw CommanderError for %s', (code) => {
            const error: CoreError = {
                code,
                message: `Test message for ${code}`,
            };

            expect(() => throwCoreError(error)).toThrow(CommanderError);
        });

        it('should set exitCode to 1 for CommanderError', () => {
            const error: CoreError = {
                code: 'MEMORY_NOT_FOUND',
                message: 'Memory not found at path',
            };

            try {
                throwCoreError(error);
                expect.unreachable('mapCoreError should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(CommanderError);
                expect((e as CommanderError).exitCode).toBe(1);
            }
        });

        it('should preserve error code in CommanderError', () => {
            const error: CoreError = {
                code: 'STORE_NOT_FOUND',
                message: 'Store not found',
            };

            try {
                throwCoreError(error);
                expect.unreachable('mapCoreError should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(CommanderError);
                expect((e as CommanderError).code).toBe('STORE_NOT_FOUND');
            }
        });

        it('should preserve error message in CommanderError', () => {
            const error: CoreError = {
                code: 'FILE_READ_FAILED',
                message: 'Could not read file: /path/to/file.txt',
            };

            try {
                throwCoreError(error);
                expect.unreachable('mapCoreError should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(CommanderError);
                expect((e as CommanderError).message).toBe(
                    'Could not read file: /path/to/file.txt'
                );
            }
        });

        it('should handle empty message for non-argument errors', () => {
            const error: CoreError = {
                code: 'INTERNAL_ERROR',
                message: '',
            };

            try {
                throwCoreError(error);
                expect.unreachable('mapCoreError should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(CommanderError);
                expect((e as CommanderError).message).toBe('');
            }
        });
    });

    describe('edge cases', () => {
        it('should handle unknown error codes as non-argument errors', () => {
            const error: CoreError = {
                code: 'COMPLETELY_UNKNOWN_CODE',
                message: 'An unexpected error',
            };

            try {
                throwCoreError(error);
                expect.unreachable('mapCoreError should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(CommanderError);
                expect((e as CommanderError).code).toBe('COMPLETELY_UNKNOWN_CODE');
            }
        });

        it('should handle error codes that are similar to argument codes', () => {
            const error: CoreError = {
                code: 'INVALID_PATH_EXTRA', // Similar but not in the set
                message: 'This should be a CommanderError',
            };

            try {
                throwCoreError(error);
                expect.unreachable('mapCoreError should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(CommanderError);
            }
        });

        it('should be case-sensitive for error codes', () => {
            const error: CoreError = {
                code: 'invalid_path', // lowercase version
                message: 'This should be a CommanderError due to case sensitivity',
            };

            try {
                throwCoreError(error);
                expect.unreachable('mapCoreError should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(CommanderError);
            }
        });

        it('should handle message with special characters', () => {
            const error: CoreError = {
                code: 'INVALID_PATH',
                message: 'Path contains invalid chars: <>&"\'\n\t',
            };

            try {
                throwCoreError(error);
                expect.unreachable('mapCoreError should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(InvalidArgumentError);
                expect((e as InvalidArgumentError).message).toBe(
                    'Path contains invalid chars: <>&"\'\n\t'
                );
            }
        });

        it('should handle very long error messages', () => {
            const longMessage = 'A'.repeat(10000);
            const error: CoreError = {
                code: 'MEMORY_NOT_FOUND',
                message: longMessage,
            };

            try {
                throwCoreError(error);
                expect.unreachable('mapCoreError should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(CommanderError);
                expect((e as CommanderError).message).toBe(longMessage);
            }
        });
    });

    describe('return type verification', () => {
        it('should never return (always throws)', () => {
            const error: CoreError = {
                code: 'INVALID_PATH',
                message: 'Test',
            };

            let didReturn = false;
            try {
                throwCoreError(error);
                didReturn = true;
            } catch {
                // Expected
            }

            expect(didReturn).toBe(false);
        });
    });
});
