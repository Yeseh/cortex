import { describe, it, expect } from 'bun:test';
import { isTTY } from './prompts.ts';

describe('isTTY', () => {
    it('should return true when stream.isTTY is true', () => {
        const stream = { isTTY: true } as unknown as NodeJS.ReadStream;
        expect(isTTY(stream)).toBe(true);
    });

    it('should return false when stream.isTTY is false', () => {
        const stream = { isTTY: false } as unknown as NodeJS.ReadStream;
        expect(isTTY(stream)).toBe(false);
    });

    it('should return false when stream.isTTY is undefined', () => {
        const stream = {} as unknown as NodeJS.ReadStream;
        expect(isTTY(stream)).toBe(false);
    });

    it('should return false when stream is undefined', () => {
        expect(isTTY(undefined)).toBe(false);
    });
});
