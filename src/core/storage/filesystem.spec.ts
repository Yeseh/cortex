import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FilesystemStorageAdapter } from './filesystem.ts';

describe('filesystem storage adapter', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-storage-'));
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it('should write and read memory files', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const writeResult = await adapter.writeMemoryFile(
            'working/storage-test',
            'Filesystem payload',
        );

        expect(writeResult.ok).toBe(true);

        const readResult = await adapter.readMemoryFile('working/storage-test');

        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
            expect(readResult.value).toBe('Filesystem payload');
        }
    });

    it('should store memories directly under store root', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        await adapter.writeMemoryFile('global/test-memory', 'test content', {
            allowIndexUpdate: false,
        });

        // Verify physical file location
        const memoryPath = join(tempDir, 'global', 'test-memory.md');
        const content = await fs.readFile(memoryPath, 'utf8');
        expect(content).toBe('test content');
    });

    it('should return ok(null) for missing memory files', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const result = await adapter.readMemoryFile('working/missing-file');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBeNull();
        }
    });

    it('should reject memory path traversal', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const readResult = await adapter.readMemoryFile('../escape');

        expect(readResult.ok).toBe(false);
        if (!readResult.ok) {
            expect(readResult.error.code).toBe('READ_FAILED');
            expect(readResult.error.message).toContain('Path escapes storage root');
        }

        const writeResult = await adapter.writeMemoryFile('../escape', 'nope');

        expect(writeResult.ok).toBe(false);
        if (!writeResult.ok) {
            expect(writeResult.error.code).toBe('WRITE_FAILED');
            expect(writeResult.error.message).toContain('Invalid memory slug path');
        }
    });

    it('should reject index as memory slug', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const result = await adapter.writeMemoryFile('global/index', 'content');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('reserved');
        }
    });

    it('should write and read index files at category path', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        // Write root index (empty string = STORE_ROOT/index.yaml)
        const writeRootResult = await adapter.writeIndexFile('', 'memories: []');
        expect(writeRootResult.ok).toBe(true);

        const readRootResult = await adapter.readIndexFile('');
        expect(readRootResult.ok).toBe(true);
        if (readRootResult.ok) {
            expect(readRootResult.value).toBe('memories: []');
        }

        // Write category index (global = STORE_ROOT/global/index.yaml)
        const writeCatResult = await adapter.writeIndexFile('global', 'memories: []');
        expect(writeCatResult.ok).toBe(true);

        const readCatResult = await adapter.readIndexFile('global');
        expect(readCatResult.ok).toBe(true);
        if (readCatResult.ok) {
            expect(readCatResult.value).toBe('memories: []');
        }
    });

    it('should store indexes in-folder at correct paths', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        await adapter.writeIndexFile('', 'root index');
        await adapter.writeIndexFile('global', 'global index');
        await adapter.writeIndexFile('global/sub', 'sub index');

        // Verify physical file locations using fs.access or fs.readFile
        const rootIndexPath = join(tempDir, 'index.yaml');
        const globalIndexPath = join(tempDir, 'global', 'index.yaml');
        const subIndexPath = join(tempDir, 'global', 'sub', 'index.yaml');

        await expect(fs.access(rootIndexPath)).resolves.not.toThrow();
        await expect(fs.access(globalIndexPath)).resolves.not.toThrow();
        await expect(fs.access(subIndexPath)).resolves.not.toThrow();
    });

    it('should return ok(null) for missing index files', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const result = await adapter.readIndexFile('missing-index');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBeNull();
        }
    });

    it('should reject index path traversal', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const readResult = await adapter.readIndexFile('../escape-index');

        expect(readResult.ok).toBe(false);
        if (!readResult.ok) {
            expect(readResult.error.code).toBe('READ_FAILED');
            expect(readResult.error.message).toContain('Path escapes storage root');
        }
    });
});
