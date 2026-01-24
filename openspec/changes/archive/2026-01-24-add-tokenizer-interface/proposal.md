# Change: Add tokenizer interface

## Why
Token estimation is needed for summaries and output sizing, and it must be abstracted so future tokenizers can be swapped in without changing core logic.

## What Changes
- Define a tokenizer interface for estimating token counts.
- Provide a v1 heuristic estimator implementation.

## Impact
- Affected specs: tokenizer
- Affected code: src/core/tokens.ts
