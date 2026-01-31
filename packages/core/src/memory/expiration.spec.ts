/**
 * Tests for memory expiration utilities.
 * @module core/memory/expiration.spec
 */

import { describe, it, expect } from 'bun:test';
import { isExpired, isExpiredNow } from './expiration.ts';

describe('isExpired', () => {
    it('should return false when expiresAt is undefined', () => {
        const now = new Date('2025-06-15T12:00:00Z');
        expect(isExpired(undefined, now)).toBe(false);
    });

    it('should return false when expiresAt is in the future', () => {
        const now = new Date('2025-01-15T12:00:00Z');
        const expiresAt = new Date('2025-06-15T12:00:00Z');
        expect(isExpired(expiresAt, now)).toBe(false);
    });

    it('should return true when expiresAt is in the past', () => {
        const now = new Date('2025-06-15T12:00:00Z');
        const expiresAt = new Date('2025-01-15T12:00:00Z');
        expect(isExpired(expiresAt, now)).toBe(true);
    });

    it('should return true when expiresAt equals now (boundary case)', () => {
        const now = new Date('2025-06-15T12:00:00Z');
        const expiresAt = new Date('2025-06-15T12:00:00Z');
        expect(isExpired(expiresAt, now)).toBe(true);
    });
});

describe('isExpiredNow', () => {
    it('should return false when expiresAt is undefined', () => {
        expect(isExpiredNow(undefined)).toBe(false);
    });

    it('should return false when expiresAt is far in the future', () => {
        const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
        expect(isExpiredNow(futureDate)).toBe(false);
    });

    it('should return true when expiresAt is in the past', () => {
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
        expect(isExpiredNow(pastDate)).toBe(true);
    });
});
