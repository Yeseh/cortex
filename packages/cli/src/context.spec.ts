import { describe, expect, it } from 'bun:test';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

import {
    getDefaultGlobalStorePath,
    getDefaultConfigPath,
} from './context.ts';

describe('context', () => {
    describe('getDefaultGlobalStorePath', () => {
        it('should return path ending with .config/cortex/memory', () => {
            const path = getDefaultGlobalStorePath();
            expect(path.endsWith(join('.config', 'cortex', 'memory'))).toBe(true);
        });

        it('should use homedir as base', () => {
            const path = getDefaultGlobalStorePath();
            expect(path.startsWith(homedir())).toBe(true);
        });

        it('should return absolute path', () => {
            const path = getDefaultGlobalStorePath();
            expect(isAbsolute(path)).toBe(true);
        });

        it('should return consistent value on multiple calls', () => {
            const first = getDefaultGlobalStorePath();
            const second = getDefaultGlobalStorePath();
            expect(first).toBe(second);
        });
    });

    describe('getDefaultRegistryPath', () => {
        it('should return path ending with .config/cortex/config.yaml', () => {
            const path = getDefaultConfigPath();
            expect(path.endsWith(join('.config', 'cortex', 'config.yaml'))).toBe(true);
        });

        it('should use homedir as base', () => {
            const path = getDefaultConfigPath();
            expect(path.startsWith(homedir())).toBe(true);
        });

        it('should return absolute path', () => {
            const path = getDefaultConfigPath();
            expect(isAbsolute(path)).toBe(true);
        });

        it('should return consistent value on multiple calls', () => {
            const first = getDefaultConfigPath();
            const second = getDefaultConfigPath();
            expect(first).toBe(second);
        });
    });
});
