/** Result type for non-throwing operations */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Provides structured error information including an error code for
 * programmatic handling, a human-readable message, and optional
 * context about the specific field or line that caused the error.
 */
export type ErrorDetails<TCode> = {
    /** Machine-readable error code for programmatic handling */
    code: TCode;
    /** Human-readable error message */
    message: string;
    /** Field name that caused the error (when applicable) */
    field?: string;
    /** Line number where the error occurred (for parse errors) */
    line?: number;
    /** Memory path that caused the error (when applicable) */
    path?: string;
    /** Underlying error that caused this failure (for debugging) */
    cause?: unknown;
}

export class Ok<T> {
    readonly value: T;
    readonly error: undefined = undefined;

    constructor(value: T) {
        this.value = value;
    }

    ok(): this is Ok<T> {
        return true;
    }

    err(): this is Err<never> {
        return false;
    }

    unwrap(): T {
        return this.value;
    }
}

export class Err<E> {
    readonly value: undefined = undefined;
    readonly error: E;

    constructor(error: E) {
        this.error = error;
    }

    ok(): this is Ok<never> {
        return false;
    }

    err(): this is Err<E> {
        return true;
    }

    unwrap(): never {
        throw new Error(`Tried to unwrap an error result: ${JSON.stringify(this.error)}`);
    }
}

export const ok = <T>(value: T): Result<T, never> => new Ok(value);

export const err = <T>(error: T): Result<never, T> => new Err(error);

