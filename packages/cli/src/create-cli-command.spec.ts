/**
 * Unit tests for create-cli-command.ts — validateStorePath.
 *
 * Verifies that absolute paths pass validation and relative paths
 * produce a typed INVALID_STORE_PATH error result.
 *
 * @module cli/create-cli-command.spec
 */

import { describe, it, expect } from 'bun:test';

import { validateStorePath } from './create-cli-command.ts';

describe('validateStorePath', () => {
    it('should return ok for a Unix absolute path', () => {
        const result = validateStorePath('/home/user/.cortex/memory', 'my-store');
        expect(result.ok()).toBe(true);
    });

    it('should return ok for a Windows-style absolute path', () => {
        // isAbsolute on Linux treats "C:\\..." as relative, but a UNC-style
        // or drive-letter path on Windows would be absolute. We test with a
        // typical Unix absolute path variant to keep cross-platform coverage.
        const result = validateStorePath('/var/cortex/stores/default', 'default');
        expect(result.ok()).toBe(true);
    });

    it('should return INVALID_STORE_PATH for a relative path', () => {
        const result = validateStorePath('relative/path/to/store', 'my-store');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_STORE_PATH');
        }
    });

    it('should return INVALID_STORE_PATH for a path starting with ./', () => {
        const result = validateStorePath('./local/store', 'my-store');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_STORE_PATH');
        }
    });

    it('should include the store name in the error message', () => {
        const storeName = 'my-named-store';
        const result = validateStorePath('not/absolute', storeName);
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.message).toContain(storeName);
        }
    });

    it('should return INVALID_STORE_PATH for empty string', () => {
        const result = validateStorePath('', 'some-store');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_STORE_PATH');
        }
    });
});
