/**
 * Unit tests for CLI path resolution utilities.
 *
 * @module cli/paths.spec
 */

import { describe, expect, it } from 'bun:test';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

import { getDefaultConfigPath, getDefaultGlobalStorePath, isAbsolutePath, resolveUserPath } from './paths.ts';
import { validateStorePath } from '../context.ts';

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

describe('validateStorePath', () => {
    it('should return ok for absolute path', () => {
        const result = validateStorePath('/absolute/path/to/store', 'my-store');
        expect(result.ok()).toBe(true);
    });

    it('should return INVALID_STORE_PATH error for relative path', () => {
        const result = validateStorePath('relative/path', 'my-store');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_STORE_PATH');
        }
    });

    it('should return INVALID_STORE_PATH error for empty path', () => {
        const result = validateStorePath('', 'my-store');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_STORE_PATH');
        }
    });

    it('should include the store name in the error message', () => {
        const result = validateStorePath('relative/path', 'cortex-store');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.message).toContain('cortex-store');
        }
    });

    it('should return ok for ~ expanded paths that are absolute after resolution', () => {
        // validateStorePath uses isAbsolute directly - ~ is NOT expanded here
        // so ~/path is NOT absolute according to isAbsolute
        const result = validateStorePath('~/memory', 'my-store');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_STORE_PATH');
        }
    });
});

describe('getDefaultGlobalStorePath', () => {
    it('should return an absolute path', () => {
        const path = getDefaultGlobalStorePath();
        expect(isAbsolute(path)).toBe(true);
    });

    it('should end with cortex/memory', () => {
        const path = getDefaultGlobalStorePath();
        expect(path.endsWith(join('cortex', 'memory'))).toBe(true);
    });

    it('should be under the homedir', () => {
        const path = getDefaultGlobalStorePath();
        expect(path.startsWith(homedir())).toBe(true);
    });

    it('should return a consistent value on multiple calls', () => {
        const first = getDefaultGlobalStorePath();
        const second = getDefaultGlobalStorePath();
        expect(first).toBe(second);
    });
});

describe('getDefaultConfigPath', () => {
    it('should return an absolute path', () => {
        const path = getDefaultConfigPath();
        expect(isAbsolute(path)).toBe(true);
    });

    it('should end with cortex/config.yaml', () => {
        const path = getDefaultConfigPath();
        expect(path.endsWith(join('cortex', 'config.yaml'))).toBe(true);
    });

    it('should be under the homedir', () => {
        const path = getDefaultConfigPath();
        expect(path.startsWith(homedir())).toBe(true);
    });

    it('should return a consistent value on multiple calls', () => {
        const first = getDefaultConfigPath();
        const second = getDefaultConfigPath();
        expect(first).toBe(second);
    });

    it('should prefer CORTEX_CONFIG when set', () => {
        const previous = process.env.CORTEX_CONFIG;
        const previousDir = process.env.CORTEX_CONFIG_DIR;
        process.env.CORTEX_CONFIG = '/tmp/custom-config.yaml';
        process.env.CORTEX_CONFIG_DIR = '/tmp/ignored-dir';

        const path = getDefaultConfigPath();

        if (previous === undefined) {
            Reflect.deleteProperty(process.env, 'CORTEX_CONFIG');
        }
        else {
            process.env.CORTEX_CONFIG = previous;
        }
        if (previousDir === undefined) {
            Reflect.deleteProperty(process.env, 'CORTEX_CONFIG_DIR');
        }
        else {
            process.env.CORTEX_CONFIG_DIR = previousDir;
        }

        expect(path).toBe('/tmp/custom-config.yaml');
    });

    it('should use CORTEX_CONFIG_DIR when CORTEX_CONFIG is unset', () => {
        const previous = process.env.CORTEX_CONFIG;
        const previousDir = process.env.CORTEX_CONFIG_DIR;
        Reflect.deleteProperty(process.env, 'CORTEX_CONFIG');
        process.env.CORTEX_CONFIG_DIR = '/tmp/custom-config-dir';

        const path = getDefaultConfigPath();

        if (previous === undefined) {
            Reflect.deleteProperty(process.env, 'CORTEX_CONFIG');
        }
        else {
            process.env.CORTEX_CONFIG = previous;
        }
        if (previousDir === undefined) {
            Reflect.deleteProperty(process.env, 'CORTEX_CONFIG_DIR');
        }
        else {
            process.env.CORTEX_CONFIG_DIR = previousDir;
        }

        expect(path).toBe(join('/tmp/custom-config-dir', 'config.yaml'));
    });
});
