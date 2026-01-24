import { describe, expect, it } from "bun:test";

import {
  defaultTokenizer,
  estimateTokensHeuristicV1,
} from "../src/core/tokens.ts";

describe("token estimation", () => {
  describe("heuristic tokenizer v1", () => {
    it("should return 0 for empty content", () => {
      const result = estimateTokensHeuristicV1("");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(0);
      }
    });

    it("should return 0 for whitespace-only content", () => {
      const result = estimateTokensHeuristicV1("   \n\t  ");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(0);
      }
    });

    it("should return at least 1 for short non-empty strings", () => {
      const result = estimateTokensHeuristicV1("hi");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(1);
      }
    });

    it("should estimate tokens based on trimmed length", () => {
      const result = estimateTokensHeuristicV1("hello world");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(3);
      }
    });

    it("should round up token estimates at boundary lengths", () => {
      const cases = [
        { content: "abcd", expected: 1 },
        { content: "abcde", expected: 2 },
        { content: "abcdefgh", expected: 2 },
        { content: "abcdefghi", expected: 3 },
      ];

      for (const testCase of cases) {
        const result = estimateTokensHeuristicV1(testCase.content);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe(testCase.expected);
        }
      }
    });

    it("should ignore surrounding whitespace in token estimate", () => {
      const result = estimateTokensHeuristicV1("  hello  ");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(2);
      }
    });

    it("should return deterministic estimates for the same input", () => {
      const first = estimateTokensHeuristicV1("repeatable result");
      const second = estimateTokensHeuristicV1("repeatable result");

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (first.ok && second.ok) {
        expect(first.value).toBe(second.value);
      }
    });

    it("should reject non-string content", () => {
      const result = estimateTokensHeuristicV1(42 as unknown as string);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_CONTENT");
        expect(result.error.message).toBe(
          "Token estimator expects string content."
        );
      }
    });
  });

  it("should expose the heuristic estimator as default", () => {
    const result = defaultTokenizer.estimateTokens("token test");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(3);
    }
  });
});
