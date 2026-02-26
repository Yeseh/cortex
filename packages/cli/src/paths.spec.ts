/**
 * Unit tests for CLI path resolution utilities.
 *
 * @module cli/paths.spec
 */

import { describe, expect, it } from 'bun:test';
import { homedir } from 'node:os';
import { isAbsolute } from 'node:path';

import { isAbsolutePath, resolveUserPath } from './paths.ts';

describe('isAbsolutePath', () => {
    it('should return true for Unix absolute path starting with /', () => {
        expect(isAbsolutePath('/home/user/foo')).toBe(true);
    });

    it('should return true for Unix root path /', () => {
        expect(isAbsolutePath('/')).toBe(true);
    });

    it('should return true for Windows drive path C:\\', () => {
        expect(isAbsolutePath('C:\\Users\\foo')).toBe(true);
    });

    it('should return true for Windows drive path D:/', () => {
        expect(isAbsolutePath('D:/Users/foo')).toBe(true);
    });

    it('should return true for UNC path \\\\server\\share', () => {
        expect(isAbsolutePath('\\\\server\\share')).toBe(true);
    });

    it('should return true for UNC path //server/share', () => {
        expect(isAbsolutePath('//server/share')).toBe(true);
    });

    it('should return false for relative path ./foo', () => {
        expect(isAbsolutePath('./foo')).toBe(false);
    });

    it('should return false for bare filename foo.ts', () => {
        expect(isAbsolutePath('foo.ts')).toBe(false);
    });

    it('should return false for relative path ../bar', () => {
        expect(isAbsolutePath('../bar')).toBe(false);
    });

    it('should return false for empty string', () => {
        expect(isAbsolutePath('')).toBe(false);
    });
});

describe('resolveUserPath', () => {
    const cwd = '/some/working/dir';

    it('should expand ~ to homedir', () => {
        const result = resolveUserPath('~', cwd);
        expect(result).toBe(homedir());
    });

    it('should resolve ~/subdir correctly', () => {
        const result = resolveUserPath('~/subdir', cwd);
        const expected = `${homedir()}/subdir`;
        expect(result).toBe(expected);
    });

    it('should return absolute path unchanged for /abs/path', () => {
        const result = resolveUserPath('/abs/path', cwd);
        expect(result).toBe('/abs/path');
    });

    it('should resolve relative paths against cwd', () => {
        const result = resolveUserPath('relative/path', cwd);
        expect(result).toBe('/some/working/dir/relative/path');
    });

    it('should resolve ./foo relative to cwd', () => {
        const result = resolveUserPath('./foo', cwd);
        expect(result).toBe('/some/working/dir/foo');
    });

    it('should resolve ../bar relative to cwd', () => {
        const result = resolveUserPath('../bar', cwd);
        expect(result).toBe('/some/working/bar');
    });

    it('should return an absolute path for any input', () => {
        expect(isAbsolute(resolveUserPath('foo', cwd))).toBe(true);
        expect(isAbsolute(resolveUserPath('~/foo', cwd))).toBe(true);
        expect(isAbsolute(resolveUserPath('/foo', cwd))).toBe(true);
    });

    it('should handle ~ with no trailing path', () => {
        const result = resolveUserPath('~', cwd);
        expect(result).toBe(homedir());
    });
});
