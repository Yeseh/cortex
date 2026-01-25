import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FilesystemStorageAdapter } from './filesystem.ts';

describe(
    'filesystem storage adapter', () => {
        let tempDir: string;

        beforeEach(async () => {
            tempDir = await mkdtemp(join(
                tmpdir(), 'cortex-storage-',
            )); 
        });

        afterEach(async () => {
            if (tempDir) {
                await rm(
                    tempDir, { recursive: true, force: true },
                ); 
            } 
        });

        it(
            'should write and read memory files', async () => {
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
            },
        );

        it(
            'should return ok(null) for missing memory files', async () => {
                const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

                const result = await adapter.readMemoryFile('working/missing-file');

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toBeNull(); 
                }
            },
        );

        it(
            'should reject memory path traversal', async () => {
                const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

                const readResult = await adapter.readMemoryFile('../escape');

                expect(readResult.ok).toBe(false);
                if (!readResult.ok) {
                    expect(readResult.error.code).toBe('READ_FAILED');
                    expect(readResult.error.message).toContain('Path escapes storage root');
                }

                const writeResult = await adapter.writeMemoryFile(
                    '../escape', 'nope',
                );

                expect(writeResult.ok).toBe(false);
                if (!writeResult.ok) {
                    expect(writeResult.error.code).toBe('WRITE_FAILED');
                    expect(writeResult.error.message).toContain('Invalid memory slug path');
                }
            },
        );

        it(
            'should write and read index files', async () => {
                const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

                const writeResult = await adapter.writeIndexFile(
                    'memory-index', '{\n}',
                );

                expect(writeResult.ok).toBe(true);

                const readResult = await adapter.readIndexFile('memory-index');

                expect(readResult.ok).toBe(true);
                if (readResult.ok) {
                    expect(readResult.value).toBe('{\n}'); 
                }
            },
        );

        it(
            'should return ok(null) for missing index files', async () => {
                const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

                const result = await adapter.readIndexFile('missing-index');

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toBeNull(); 
                }
            },
        );

        it(
            'should reject index path traversal', async () => {
                const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

                const readResult = await adapter.readIndexFile('../escape-index');

                expect(readResult.ok).toBe(false);
                if (!readResult.ok) {
                    expect(readResult.error.code).toBe('READ_FAILED');
                    expect(readResult.error.message).toContain('Path escapes storage root');
                }
            },
        );
    },
);
