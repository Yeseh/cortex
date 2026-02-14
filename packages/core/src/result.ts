/** Result type for non-throwing operations */
export type Result<T, E> = Ok<T> | Err<E>;

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
