import { input, confirm } from '@inquirer/prompts';

export type InputFn = (opts: { message: string; default?: string }) => Promise<string>;
export type ConfirmFn = (opts: { message: string; default?: boolean }) => Promise<boolean>;

export interface PromptDeps {
    input: InputFn;
    confirm: ConfirmFn;
}

export const defaultPromptDeps: PromptDeps = { input, confirm };

export function isTTY(stream: NodeJS.ReadableStream | undefined): boolean {
    return (stream as NodeJS.ReadStream | undefined)?.isTTY === true;
}
