import { describe, expect, it } from 'bun:test';

import { Slug } from '@/slug.ts';
import type { NonEmptyString } from '@/types';

describe(
    'Slug.from()', () => {
        it(
            'should lowercase and trim input', () => {
                const input = '  Hello World  ' as NonEmptyString<'  Hello World  '>;

                const result = Slug.from(input);

                expect((result.ok())).toBe(true);
                if (result.ok()) {
                    expect(result.value.toString()).toBe('hello-world');
                }
            },
        );

        it(
            'should replace spaces and underscores with hyphens', () => {
                const input = 'hello_world  test' as NonEmptyString<'hello_world  test'>;

                const result = Slug.from(input);

                expect(result.ok()).toBe(true);
                if (result.ok()) {
                    expect(result.value.toString()).toBe('hello-world-test');
                }
            },
        );

        it(
            'should remove invalid characters', () => {
                const input = 'hello@world#2026!' as NonEmptyString<'hello@world#2026!'>;

                const result = Slug.from(input);

                expect(result.ok()).toBe(true);
                if (result.ok()) {
                    expect(result.value.toString()).toBe('helloworld2026');
                }
            },
        );

        it(
            'should collapse multiple hyphens', () => {
                const input = 'hello---world' as NonEmptyString<'hello---world'>;

                const result = Slug.from(input);

                expect(result.ok()).toBe(true);
                if (result.ok()) {
                    expect(result.value.toString()).toBe('hello-world');
                }
            },
        );

        it(
            'should trim leading and trailing hyphens', () => {
                const input = '--hello-world--' as NonEmptyString<'--hello-world--'>;

                const result = Slug.from(input);

                expect(result.ok()).toBe(true);
                if (result.ok()) {
                    expect(result.value.toString()).toBe('hello-world');
                }
            },
        );

        it(
            'should return empty string when input normalizes to nothing', () => {
                const input = '!!!' as NonEmptyString<'!!!'>;

                const result = Slug.from(input);

                expect(result.ok()).toBe(true);
                if (result.ok()) {
                    expect(result.value.toString()).toBe('');
                }
            },
        );

        it(
            'should return error when input is only whitespace', () => {
                const input = '   ' as NonEmptyString<'   '>;

                const result = Slug.from(input);

                expect(result.ok()).toBe(false);
                if (!result.ok()) {
                    expect(result.error.message).toBe('Slug cannot be empty or whitespace.');
                }
            },
        );
    },
);
