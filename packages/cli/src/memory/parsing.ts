import { throwCliError } from "../errors";

export const parseTags = (raw?: string[]): string[] =>
    raw
        ? raw
            .flatMap((tag) => tag.split(','))
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];

export const parseExpiresAt = (raw?: string): Date | undefined => {
    if (!raw) {
        return undefined;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        throwCliError({ code: 'INVALID_ARGUMENTS', message: 'Invalid expiration date format' });
    }

    return parsed;
};