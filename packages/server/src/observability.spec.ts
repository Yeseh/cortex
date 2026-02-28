import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createLogger } from './observability.ts';

describe('createLogger', () => {
    describe('ConsoleLogger (otelEnabled=false)', () => {
        let stderrLines: string[];
        let origWrite: typeof process.stderr.write;

        beforeEach(() => {
            stderrLines = [];
            origWrite = process.stderr.write.bind(process.stderr);
            process.stderr.write = ((chunk: string | Uint8Array) => {
                stderrLines.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
                return true;
            }) as any;
        });

        afterEach(() => {
            process.stderr.write = origWrite;
        });

        it('should write info log to stderr as JSON', () => {
            const logger = createLogger('info', false);
            logger.info('hello world');
            expect(stderrLines.length).toBe(1);
            const parsed = JSON.parse(stderrLines[0]!);
            expect(parsed.level).toBe('info');
            expect(parsed.msg).toBe('hello world');
            expect(parsed.ts).toBeDefined();
        });

        it('should write warn log to stderr', () => {
            const logger = createLogger('info', false);
            logger.warn('warning message', { key: 'value' });
            expect(stderrLines.length).toBe(1);
            const parsed = JSON.parse(stderrLines[0]!);
            expect(parsed.level).toBe('warn');
            expect(parsed.key).toBe('value');
        });

        it('should write error log with error details', () => {
            const logger = createLogger('info', false);
            logger.error('something failed', new Error('boom'));
            expect(stderrLines.length).toBe(1);
            const parsed = JSON.parse(stderrLines[0]!);
            expect(parsed.level).toBe('error');
            expect(parsed.error).toBe('boom');
        });

        it('should respect log level filtering — info suppresses debug', () => {
            const logger = createLogger('info', false);
            logger.debug('debug message');
            expect(stderrLines.length).toBe(0);
        });

        it('should respect log level filtering — warn suppresses info', () => {
            const logger = createLogger('warn', false);
            logger.info('info message');
            expect(stderrLines.length).toBe(0);
        });

        it('should respect log level filtering — warn allows warn', () => {
            const logger = createLogger('warn', false);
            logger.warn('warn message');
            expect(stderrLines.length).toBe(1);
        });

        it('should allow debug messages when level is debug', () => {
            const logger = createLogger('debug', false);
            logger.debug('debug message');
            expect(stderrLines.length).toBe(1);
        });

        it('should handle non-Error objects in error()', () => {
            const logger = createLogger('info', false);
            logger.error('failed', 'string error');
            expect(stderrLines.length).toBe(1);
            const parsed = JSON.parse(stderrLines[0]!);
            expect(parsed.error).toBe('string error');
        });

        it('should handle undefined error argument', () => {
            const logger = createLogger('info', false);
            logger.error('failed');
            expect(stderrLines.length).toBe(1);
        });
    });

    describe('OTel logger (otelEnabled=true)', () => {
        it('should return a logger without throwing', () => {
            expect(() => createLogger('info', true)).not.toThrow();
        });

        it('should return an object with all Logger methods', () => {
            const logger = createLogger('info', true);
            expect(typeof logger.debug).toBe('function');
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.error).toBe('function');
        });
    });
});
