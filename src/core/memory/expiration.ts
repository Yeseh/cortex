/**
 * Memory expiration utilities.
 * @module core/memory/expiration
 */

/**
 * Checks if a memory has expired relative to a given time.
 *
 * @param expiresAt - Memory expiration date (undefined means no expiration)
 * @param now - Current time for comparison
 * @returns true if the memory has expired (expiresAt <= now)
 */
export const isExpired = (expiresAt: Date | undefined, now: Date): boolean => {
    if (!expiresAt) {
        return false;
    }
    return expiresAt.getTime() <= now.getTime();
};

/**
 * Checks if a memory has expired using current time.
 * Convenience wrapper around isExpired().
 *
 * @param expiresAt - Memory expiration date (undefined means no expiration)
 * @returns true if the memory has expired
 */
export const isExpiredNow = (expiresAt: Date | undefined): boolean => {
    return isExpired(expiresAt, new Date());
};
