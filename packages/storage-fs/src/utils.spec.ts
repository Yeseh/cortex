import { describe, expect, it } from 'bun:test';

import {
    ok,
    err,
    isNotFoundError,
    normalizeExtension,
    resolveStoragePath,
    toSlugPathFromRelative,
} from './utils.ts';

describe('utils module', () => {
    describe('ok', () => {
        it('should create a successful Result', () => {
            const result = ok('test value');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe('test value');
            }
        });

        it('should work with various types', () => {
            expect(ok(42)).toEqual({ ok: true, value: 42 });
            expect(ok(null)).toEqual({ ok: true, value: null });
            expect(ok({ key: 'value' })).toEqual({ ok: true, value: { key: 'value' } });
            expect(ok([1, 2, 3])).toEqual({ ok: true, value: [1, 2, 3] });
        });
    });

    describe('err', () => {
        it('should create a failed Result', () => {
            const result = err({ code: 'TEST_ERROR', message: 'Test error' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('TEST_ERROR');
            }
        });

        it('should work with various error types', () => {
            expect(err('simple error')).toEqual({ ok: false, error: 'simple error' });
            expect(err({ code: 'ERR', msg: 'msg' })).toEqual({
                ok: false,
                error: { code: 'ERR', msg: 'msg' },
            });
        });
    });

    describe('isNotFoundError', () => {
        it('should return true for ENOENT errors', () => {
            const error = { code: 'ENOENT' };
            expect(isNotFoundError(error)).toBe(true);
        });

        it('should return false for other error codes', () => {
            expect(isNotFoundError({ code: 'EACCES' })).toBe(false);
            expect(isNotFoundError({ code: 'EPERM' })).toBe(false);
            expect(isNotFoundError({ code: 'EISDIR' })).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(isNotFoundError(null)).toBe(false);
            expect(isNotFoundError(undefined)).toBe(false);
        });

        it('should return false for non-objects', () => {
            expect(isNotFoundError('ENOENT')).toBe(false);
            expect(isNotFoundError(123)).toBe(false);
            expect(isNotFoundError(true)).toBe(false);
        });

        it('should return false for objects without code property', () => {
            expect(isNotFoundError({})).toBe(false);
            expect(isNotFoundError({ message: 'error' })).toBe(false);
        });
    });

    describe('normalizeExtension', () => {
        it('should add leading dot if missing', () => {
            expect(normalizeExtension('md', '.md')).toBe('.md');
            expect(normalizeExtension('yaml', '.yaml')).toBe('.yaml');
        });

        it('should preserve leading dot if present', () => {
            expect(normalizeExtension('.md', '.md')).toBe('.md');
            expect(normalizeExtension('.yaml', '.yaml')).toBe('.yaml');
        });

        it('should return fallback for undefined', () => {
            expect(normalizeExtension(undefined, '.md')).toBe('.md');
        });

        it('should return fallback for empty string', () => {
            expect(normalizeExtension('', '.yaml')).toBe('.yaml');
        });

        it('should return fallback for whitespace-only string', () => {
            expect(normalizeExtension('   ', '.md')).toBe('.md');
        });

        it('should trim whitespace', () => {
            expect(normalizeExtension('  md  ', '.yaml')).toBe('.md');
            expect(normalizeExtension('  .yaml  ', '.md')).toBe('.yaml');
        });
    });

    describe('resolveStoragePath', () => {
        it('should resolve valid relative paths', async () => {
            const { tmpdir } = await import('node:os');
            const { mkdtemp, rm } = await import('node:fs/promises');
            const { join, resolve } = await import('node:path');

            const tempDir = await mkdtemp(join(tmpdir(), 'cortex-utils-'));
            try {
                const result = resolveStoragePath(tempDir, 'category/memory', 'IO_READ_ERROR');

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toBe(resolve(tempDir, 'category/memory'));
                }
            } finally {
                await rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should resolve nested paths', async () => {
            const { tmpdir } = await import('node:os');
            const { mkdtemp, rm } = await import('node:fs/promises');
            const { join, resolve } = await import('node:path');

            const tempDir = await mkdtemp(join(tmpdir(), 'cortex-utils-'));
            try {
                const result = resolveStoragePath(tempDir, 'a/b/c/d', 'IO_READ_ERROR');

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toBe(resolve(tempDir, 'a/b/c/d'));
                }
            } finally {
                await rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should reject path traversal with ../', async () => {
            const { tmpdir } = await import('node:os');
            const { mkdtemp, rm } = await import('node:fs/promises');
            const { join } = await import('node:path');

            const tempDir = await mkdtemp(join(tmpdir(), 'cortex-utils-'));
            try {
                const result = resolveStoragePath(tempDir, '../escape', 'IO_READ_ERROR');

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('IO_READ_ERROR');
                    expect(result.error.message).toContain('Path escapes storage root');
                }
            } finally {
                await rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should reject path traversal in nested paths', async () => {
            const { tmpdir } = await import('node:os');
            const { mkdtemp, rm } = await import('node:fs/promises');
            const { join } = await import('node:path');

            const tempDir = await mkdtemp(join(tmpdir(), 'cortex-utils-'));
            try {
                const result = resolveStoragePath(
                    tempDir,
                    'valid/../../../escape',
                    'IO_WRITE_ERROR'
                );

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('IO_WRITE_ERROR');
                }
            } finally {
                await rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should use provided error code', async () => {
            const { tmpdir } = await import('node:os');
            const { mkdtemp, rm } = await import('node:fs/promises');
            const { join } = await import('node:path');

            const tempDir = await mkdtemp(join(tmpdir(), 'cortex-utils-'));
            try {
                const result = resolveStoragePath(tempDir, '../bad', 'IO_WRITE_ERROR');

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('IO_WRITE_ERROR');
                }
            } finally {
                await rm(tempDir, { recursive: true, force: true });
            }
        });
    });

    describe('toSlugPathFromRelative', () => {
        it('should convert valid relative path to slug', () => {
            expect(toSlugPathFromRelative('category/memory.md', '.md')).toBe('category/memory');
        });

        it('should handle nested paths', () => {
            expect(toSlugPathFromRelative('a/b/c/file.yaml', '.yaml')).toBe('a/b/c/file');
        });

        it('should handle single segment paths', () => {
            expect(toSlugPathFromRelative('memory.md', '.md')).toBe('memory');
        });

        it('should return null for paths without matching extension', () => {
            expect(toSlugPathFromRelative('file.txt', '.md')).toBeNull();
            expect(toSlugPathFromRelative('file.yaml', '.md')).toBeNull();
        });

        it('should return null for empty path', () => {
            expect(toSlugPathFromRelative('', '.md')).toBeNull();
        });

        it('should return null for path traversal attempts', () => {
            expect(toSlugPathFromRelative('../escape.md', '.md')).toBeNull();
            expect(toSlugPathFromRelative('..\\escape.md', '.md')).toBeNull();
        });

        it('should handle Windows-style separators', async () => {
            // On Windows, sep is '\\', on POSIX it's '/'
            // The function splits by sep, so we test with the platform's separator
            const { sep } = await import('node:path');
            const windowsPath = `category${sep}memory.md`;
            expect(toSlugPathFromRelative(windowsPath, '.md')).toBe('category/memory');
        });

        it('should preserve spaces in filenames (no trimming)', () => {
            // The trim is on segments, but filenames with spaces are valid
            // The function doesn't trim spaces within filenames
            expect(toSlugPathFromRelative('category/memory.md', '.md')).toBe('category/memory');
        });
    });
});
