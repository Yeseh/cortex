import { describe, expect, it } from 'bun:test';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

import { validateStorePath } from './create-cli-command.ts';
import {
    getDefaultGlobalStorePath,
    getDefaultConfigPath,
} from './context.ts';

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
});
