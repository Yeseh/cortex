import type { NonEmptyString } from '@/types';
import { type Result, err, ok } from './result';

export class Slug {
    #value: string;

    private constructor(value: string) {
        this.#value = value;
    }

    static from<T extends string>(
        input: NonEmptyString<T>,
    ): Result<Slug, {message: string}> {
        const trimmed = input.trim();
        if (trimmed.length === 0) {
            return err({message: 'Slug cannot be empty or whitespace.' });
        };

        const slug = trimmed
            .toLowerCase()
            .trim()
            .replace(/[\s_]+/g, '-')        // spaces/underscores → hyphens
            .replace(/[^a-z0-9-]/g, '')     // remove invalid chars
            .replace(/-+/g, '-')            // collapse multiple hyphens
            .replace(/^-|-$/g, '');         // trim leading/trailing hyphens

        return ok(new Slug(slug));
    }

    toString(): string {
        return this.#value;
    }

    [Symbol.toPrimitive](hint: string): string {
        if (hint === 'string') {
            return this.toString();
        }
        return this.toString();
    }

    equals(other: Slug): boolean { 
        return this.#value === other.#value;
    }
};
