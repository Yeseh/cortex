import { describe, expect, it } from 'bun:test';

import {
    defaultTokenizer,
    estimateTokensHeuristicV1,
    heuristicTokenizerV1,
    type Tokenizer,
} from './tokens.ts';

describe(
    'token estimation', () => {
        describe(
            'estimateTokensHeuristicV1', () => {
                it(
                    'should return 0 for empty content', () => {
                        const result = estimateTokensHeuristicV1('');

                        expect(result.ok).toBe(true);
                        if (result.ok) {
                            expect(result.value).toBe(0); 
                        }
                    },
                );

                it(
                    'should return 0 for whitespace-only content', () => {
                        const result = estimateTokensHeuristicV1('   \n\t  ');

                        expect(result.ok).toBe(true);
                        if (result.ok) {
                            expect(result.value).toBe(0); 
                        }
                    },
                );

                it(
                    'should return at least 1 for short non-empty strings', () => {
                        const result = estimateTokensHeuristicV1('hi');

                        expect(result.ok).toBe(true);
                        if (result.ok) {
                            expect(result.value).toBe(1); 
                        }
                    },
                );

                it(
                    'should estimate tokens based on trimmed length', () => {
                        const result = estimateTokensHeuristicV1('hello world');

                        expect(result.ok).toBe(true);
                        if (result.ok) {
                            expect(result.value).toBe(3); // 11 chars / 4 = 2.75, ceil = 3
                        }
                    },
                );

                it(
                    'should round up token estimates at boundary lengths', () => {
                        const cases = [
                            { content: 'abcd', expected: 1 }, // 4 chars / 4 = 1
                            { content: 'abcde', expected: 2 }, // 5 chars / 4 = 1.25, ceil = 2
                            { content: 'abcdefgh', expected: 2 }, // 8 chars / 4 = 2
                            { content: 'abcdefghi', expected: 3 }, // 9 chars / 4 = 2.25, ceil = 3
                        ];

                        for (const testCase of cases) {
                            const result = estimateTokensHeuristicV1(testCase.content);

                            expect(result.ok).toBe(true);
                            if (result.ok) {
                                expect(result.value).toBe(testCase.expected); 
                            }
                        }
                    },
                );

                it(
                    'should ignore surrounding whitespace in token estimate', () => {
                        const result = estimateTokensHeuristicV1('  hello  ');

                        expect(result.ok).toBe(true);
                        if (result.ok) {
                            expect(result.value).toBe(2); // 5 chars / 4 = 1.25, ceil = 2
                        }
                    },
                );

                it(
                    'should return deterministic estimates for the same input', () => {
                        const first = estimateTokensHeuristicV1('repeatable result');
                        const second = estimateTokensHeuristicV1('repeatable result');

                        expect(first.ok).toBe(true);
                        expect(second.ok).toBe(true);
                        if (first.ok && second.ok) {
                            expect(first.value).toBe(second.value); 
                        }
                    },
                );

                it(
                    'should reject non-string content', () => {
                        const result = estimateTokensHeuristicV1(42 as unknown as string);

                        expect(result.ok).toBe(false);
                        if (!result.ok) {
                            expect(result.error.code).toBe('INVALID_CONTENT');
                            expect(result.error.message).toBe('Token estimator expects string content.');
                        }
                    },
                );

                it(
                    'should handle very long content', () => {
                        const longContent = 'x'.repeat(10000);
                        const result = estimateTokensHeuristicV1(longContent);

                        expect(result.ok).toBe(true);
                        if (result.ok) {
                            expect(result.value).toBe(2500); // 10000 chars / 4 = 2500
                        }
                    },
                );

                it(
                    'should handle content with newlines', () => {
                        const result = estimateTokensHeuristicV1('line1\nline2\nline3');

                        expect(result.ok).toBe(true);
                        if (result.ok) {
                            expect(result.value).toBe(5); // 17 chars / 4 = 4.25, ceil = 5
                        }
                    },
                );

                it(
                    'should handle single character content', () => {
                        const result = estimateTokensHeuristicV1('a');

                        expect(result.ok).toBe(true);
                        if (result.ok) {
                            expect(result.value).toBe(1); // max(1, ceil(1/4)) = max(1, 1) = 1
                        }
                    },
                );
            },
        );

        describe(
            'heuristicTokenizerV1', () => {
                it(
                    'should implement Tokenizer interface', () => {
                        const tokenizer: Tokenizer = heuristicTokenizerV1;

                        expect(typeof tokenizer.estimateTokens).toBe('function');
                    },
                );

                it(
                    'should delegate to estimateTokensHeuristicV1', () => {
                        const result = heuristicTokenizerV1.estimateTokens('test content');

                        expect(result.ok).toBe(true);
                        if (result.ok) {
                            expect(result.value).toBe(3); // 12 chars / 4 = 3
                        }
                    },
                );
            },
        );

        describe(
            'defaultTokenizer', () => {
                it(
                    'should expose the heuristic estimator as default', () => {
                        const result = defaultTokenizer.estimateTokens('token test');

                        expect(result.ok).toBe(true);
                        if (result.ok) {
                            expect(result.value).toBe(3); // 10 chars / 4 = 2.5, ceil = 3
                        }
                    },
                );

                it(
                    'should be the same as heuristicTokenizerV1', () => {
                        expect(defaultTokenizer).toBe(heuristicTokenizerV1); 
                    },
                );
            },
        );
    },
);
