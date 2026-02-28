import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createCliLogger } from './observability.ts';

describe('createCliLogger', () => {
    let stderrLines: string[];
    let origWrite: typeof process.stderr.write;
    let origDebugEnv: string | undefined;

    beforeEach(() => {
        stderrLines = [];
        origWrite = process.stderr.write.bind(process.stderr);
        origDebugEnv = process.env.DEBUG;
        process.stderr.write = ((chunk: string | Uint8Array) => {
            stderrLines.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
            return true;
        }) as any;
    });

    afterEach(() => {
        process.stderr.write = origWrite;
        if (origDebugEnv === undefined) {
            delete process.env.DEBUG;
        }
        else {
            process.env.DEBUG = origDebugEnv;
        }
    });

    describe('info()', () => {
        it('should write info log to stderr as JSON', () => {
            const logger = createCliLogger();
            logger.info('hello world');
            expect(stderrLines.length).toBe(1);
            const parsed = JSON.parse(stderrLines[0]!);
            expect(parsed.level).toBe('info');
            expect(parsed.msg).toBe('hello world');
            expect(parsed.ts).toBeDefined();
        });

        it('should include metadata in the log line', () => {
            const logger = createCliLogger();
            logger.info('test', { store: 'default', count: 5 });
            const parsed = JSON.parse(stderrLines[0]!);
            expect(parsed.store).toBe('default');
            expect(parsed.count).toBe(5);
        });
    });

    describe('warn()', () => {
        it('should write warn log to stderr', () => {
            const logger = createCliLogger();
            logger.warn('warning message');
            expect(stderrLines.length).toBe(1);
            const parsed = JSON.parse(stderrLines[0]!);
            expect(parsed.level).toBe('warn');
            expect(parsed.msg).toBe('warning message');
        });
    });

    describe('error()', () => {
        it('should write error log with Error object details', () => {
            const logger = createCliLogger();
            logger.error('something failed', new Error('boom'));
            expect(stderrLines.length).toBe(1);
            const parsed = JSON.parse(stderrLines[0]!);
            expect(parsed.level).toBe('error');
            expect(parsed.msg).toBe('something failed');
            expect(parsed.error).toBe('boom');
        });

        it('should handle string error argument', () => {
            const logger = createCliLogger();
            logger.error('failed', 'string error');
            const parsed = JSON.parse(stderrLines[0]!);
            expect(parsed.error).toBe('string error');
        });

        it('should handle missing error argument', () => {
            const logger = createCliLogger();
            logger.error('failed');
            expect(stderrLines.length).toBe(1);
            const parsed = JSON.parse(stderrLines[0]!);
            expect(parsed.error).toBeUndefined();
        });
    });

    describe('debug()', () => {
        it('should suppress debug output when DEBUG env is not set', () => {
            delete process.env.DEBUG;
            const logger = createCliLogger();
            logger.debug('debug message');
            expect(stderrLines.length).toBe(0);
        });

        it('should write debug output when DEBUG=cortex', () => {
            process.env.DEBUG = 'cortex';
            const logger = createCliLogger();
            logger.debug('debug message');
            expect(stderrLines.length).toBe(1);
            const parsed = JSON.parse(stderrLines[0]!);
            expect(parsed.level).toBe('debug');
        });

        it('should write debug output when DEBUG includes cortex alongside other values', () => {
            process.env.DEBUG = 'express,cortex,http';
            const logger = createCliLogger();
            logger.debug('debug message');
            expect(stderrLines.length).toBe(1);
        });

        it('should suppress debug when DEBUG is set to a different value', () => {
            process.env.DEBUG = 'express';
            const logger = createCliLogger();
            logger.debug('debug message');
            expect(stderrLines.length).toBe(0);
        });
    });

    describe('Logger interface compliance', () => {
        it('should not write to stdout', () => {
            const stdoutLines: string[] = [];
            const origStdoutWrite = process.stdout.write.bind(process.stdout);
            process.stdout.write = ((chunk: string | Uint8Array) => {
                stdoutLines.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
                return true;
            }) as any;
            try {
                const logger = createCliLogger();
                logger.info('test');
                logger.warn('test');
                logger.error('test');
                expect(stdoutLines.length).toBe(0);
            }
            finally {
                process.stdout.write = origStdoutWrite;
            }
        });
    });
});
