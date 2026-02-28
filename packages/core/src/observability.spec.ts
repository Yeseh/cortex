import { describe, it, expect, mock } from 'bun:test';
import { NoopLogger } from './observability.ts';

describe('NoopLogger', () => {
    it('should implement the Logger interface', () => {
        const logger = new NoopLogger();
        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.error).toBe('function');
    });

    it('should not produce any output for debug()', () => {
        const writeStub = mock(() => {});
        const origWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = writeStub as any;
        try {
            const logger = new NoopLogger();
            logger.debug('test message', { key: 'value' });
            expect(writeStub).not.toHaveBeenCalled();
        }
        finally {
            process.stderr.write = origWrite as any;
        }
    });

    it('should not produce any output for info()', () => {
        const writeStub = mock(() => {});
        const origWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = writeStub as any;
        try {
            const logger = new NoopLogger();
            logger.info('test message');
            expect(writeStub).not.toHaveBeenCalled();
        }
        finally {
            process.stderr.write = origWrite as any;
        }
    });

    it('should not produce any output for warn()', () => {
        const writeStub = mock(() => {});
        const origWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = writeStub as any;
        try {
            const logger = new NoopLogger();
            logger.warn('test message');
            expect(writeStub).not.toHaveBeenCalled();
        }
        finally {
            process.stderr.write = origWrite as any;
        }
    });

    it('should not produce any output for error()', () => {
        const writeStub = mock(() => {});
        const origWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = writeStub as any;
        try {
            const logger = new NoopLogger();
            logger.error('test error', new Error('something failed'));
            expect(writeStub).not.toHaveBeenCalled();
        }
        finally {
            process.stderr.write = origWrite as any;
        }
    });

    it('should accept all valid call signatures without throwing', () => {
        const logger = new NoopLogger();
        expect(() => {
            logger.debug('msg');
            logger.debug('msg', { key: 'val' });
            logger.info('msg');
            logger.warn('msg');
            logger.error('msg');
            logger.error('msg', new Error('err'));
            logger.error('msg', new Error('err'), { ctx: 'test' });
            logger.error('msg', 'string error');
        }).not.toThrow();
    });
});
