/**
 * Token estimation helpers and interfaces.
 */

import type { Result } from "./types.ts";

export interface TokenizerError {
  code: "INVALID_CONTENT" | "INVALID_ESTIMATE";
  message: string;
}

export interface Tokenizer {
  estimateTokens(content: string): Result<number, TokenizerError>;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const validateContent = (content: string): Result<string, TokenizerError> => {
  // Runtime guard for JS callers and untyped boundaries.
  if (typeof content !== "string") {
    return err({
      code: "INVALID_CONTENT",
      message: "Token estimator expects string content.",
    });
  }
  return ok(content);
};

export const estimateTokensHeuristicV1 = (
  content: string
): Result<number, TokenizerError> => {
  const validContent = validateContent(content);
  if (!validContent.ok) {
    return validContent;
  }

  const trimmed = validContent.value.trim();
  if (!trimmed) {
    return ok(0);
  }

  // `trimmed.length` is finite and non-negative, so the estimate cannot be
  // negative or non-finite here.
  return ok(Math.max(1, Math.ceil(trimmed.length / 4)));
};

export const heuristicTokenizerV1: Tokenizer = {
  estimateTokens: estimateTokensHeuristicV1,
};

export const defaultTokenizer = heuristicTokenizerV1;
