/**
 * CLI command entrypoint routing for Cortex.
 */

import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { Result } from '../core/types.ts';
import type { CortexConfig, OutputFormat } from '../core/config.ts';
import { loadConfig } from '../core/config.ts';
import { resolveStore } from '../core/store/store.ts';
import { runReindexCommand } from './commands/reindex.ts';
import { runAddCommand } from './commands/add.ts';
import { runUpdateCommand } from './commands/update.ts';
import { runListCommand } from './commands/list.ts';
import { runPruneCommand } from './commands/prune.ts';
import { runShowCommand } from './commands/show.ts';
import { runRemoveCommand } from './commands/remove.ts';
import { runMoveCommand } from './commands/move.ts';
import { runHelpCommand, MAIN_HELP, COMMAND_HELP } from './commands/help.ts';
import { runStoreCommand } from './commands/store.ts';
import { runInitCommand } from './commands/init.ts';
import { serializeOutput } from './output.ts';

export interface CliRunResult {
    exitCode: number;
    output?: string;
    error?: string;
}

export interface CliRunOptions {
    args?: string[];
    cwd?: string;
    globalStorePath?: string;
}

export interface CliRunError {
    code:
        | 'INVALID_COMMAND'
        | 'CONFIG_LOAD_FAILED'
        | 'STORE_RESOLUTION_FAILED'
        | 'REINDEX_FAILED'
        | 'ADD_FAILED'
        | 'UPDATE_FAILED'
        | 'LIST_FAILED'
        | 'PRUNE_FAILED'
        | 'SHOW_FAILED'
        | 'REMOVE_FAILED'
        | 'MOVE_FAILED'
        | 'HELP_FAILED'
        | 'STORE_COMMAND_FAILED'
        | 'INIT_FAILED';
    message: string;
    cause?: unknown;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const formatError = (error: CliRunError): CliRunResult => ({
    exitCode: 1,
    error: error.message,
});

const parseStoreFlag = (args: string[]): { store?: string; remaining: string[] } => {
    const remaining: string[] = [];
    let store: string | undefined;

    for (let index = 0; index < args.length; index += 1) {
        const value = args[index];
        if (!value) {
            continue;
        }

        if (value !== '--store') {
            remaining.push(value);
            continue;
        }

        const candidate = args[index + 1];
        if (!candidate) {
            store = '';
            continue;
        }

        store = candidate;
        index += 1;
    }

    return { store, remaining };
};

interface GlobalStoreParseResult {
    globalStorePath?: string;
    remaining: string[];
}

const parseGlobalStorePath = (args: string[]): GlobalStoreParseResult => {
    const remaining: string[] = [];
    let globalStorePath: string | undefined;

    for (let index = 0; index < args.length; index += 1) {
        const value = args[index];
        if (!value) {
            continue;
        }

        if (value !== '--global-store') {
            remaining.push(value);
            continue;
        }

        const candidate = args[index + 1];
        if (!candidate) {
            globalStorePath = '';
            continue;
        }

        globalStorePath = candidate;
        index += 1;
    }

    return { globalStorePath, remaining };
};

interface HelpFlagParseResult {
    hasHelp: boolean;
    remaining: string[];
}

const parseHelpFlag = (args: string[]): HelpFlagParseResult => {
    const remaining: string[] = [];
    let hasHelp = false;

    for (const value of args) {
        if (!value) {
            continue;
        }

        if (value === '--help' || value === '-h') {
            hasHelp = true;
            continue;
        }

        remaining.push(value);
    }

    return { hasHelp, remaining };
};

const toCliError = (code: CliRunError['code'], message: string, cause?: unknown): CliRunError => ({
    code,
    message,
    cause,
});

const resolveStoreRoot = async (
    args: string[],
    cwd: string,
    globalStorePath: string
): Promise<Result<{ root: string; remainingArgs: string[] }, CliRunError>> => {
    const configResult = await loadConfig({ cwd });
    if (!configResult.ok) {
        return err(
            toCliError(
                'CONFIG_LOAD_FAILED',
                `Failed to load config: ${configResult.error.message}`,
                configResult.error
            )
        );
    }

    const parsedStore = parseStoreFlag(args);
    if (parsedStore.store === '') {
        return err(toCliError('STORE_RESOLUTION_FAILED', '--store requires a value.'));
    }
    const storeResolution = await resolveStore({
        cwd,
        globalStorePath,
        config: configResult.value,
    });
    if (!storeResolution.ok) {
        return err(
            toCliError(
                'STORE_RESOLUTION_FAILED',
                storeResolution.error.message,
                storeResolution.error
            )
        );
    }

    if (parsedStore.store) {
        return err(
            toCliError(
                'STORE_RESOLUTION_FAILED',
                `Named store '${parsedStore.store}' is not supported yet.`,
                { store: parsedStore.store }
            )
        );
    }

    return ok({ root: storeResolution.value.root, remainingArgs: parsedStore.remaining });
};

type StoreCommand = 'reindex' | 'add' | 'update' | 'list' | 'prune' | 'show' | 'remove' | 'move';

const executeReindexCommand = async (
    root: string,
    remainingArgs: string[],
    _format: OutputFormat
): Promise<CliRunResult> => {
    const reindexResult = await runReindexCommand({
        storeRoot: root,
        args: remainingArgs,
    });
    if (!reindexResult.ok) {
        return formatError(
            toCliError('REINDEX_FAILED', reindexResult.error.message, reindexResult.error)
        );
    }
    return { exitCode: 0, output: reindexResult.value.message };
};

const executeAddCommand = async (
    root: string,
    remainingArgs: string[],
    _format: OutputFormat
): Promise<CliRunResult> => {
    const addResult = await runAddCommand({
        storeRoot: root,
        args: remainingArgs,
        stdin: process.stdin,
    });
    if (!addResult.ok) {
        return formatError(toCliError('ADD_FAILED', addResult.error.message, addResult.error));
    }
    return { exitCode: 0, output: addResult.value.message };
};

const executeUpdateCommand = async (
    root: string,
    remainingArgs: string[],
    _format: OutputFormat
): Promise<CliRunResult> => {
    const updateResult = await runUpdateCommand({
        storeRoot: root,
        args: remainingArgs,
        stdin: process.stdin,
    });
    if (!updateResult.ok) {
        return formatError(
            toCliError('UPDATE_FAILED', updateResult.error.message, updateResult.error)
        );
    }
    return { exitCode: 0, output: updateResult.value.message };
};

const executeListCommand = async (
    root: string,
    remainingArgs: string[],
    _format: OutputFormat
): Promise<CliRunResult> => {
    const listResult = await runListCommand({
        storeRoot: root,
        args: remainingArgs,
    });
    if (!listResult.ok) {
        return formatError(toCliError('LIST_FAILED', listResult.error.message, listResult.error));
    }
    return { exitCode: 0, output: listResult.value.message };
};

const executePruneCommand = async (
    root: string,
    remainingArgs: string[],
    _format: OutputFormat
): Promise<CliRunResult> => {
    const pruneResult = await runPruneCommand({
        storeRoot: root,
        args: remainingArgs,
    });
    if (!pruneResult.ok) {
        return formatError(
            toCliError('PRUNE_FAILED', pruneResult.error.message, pruneResult.error)
        );
    }
    return { exitCode: 0, output: pruneResult.value.message };
};

const executeShowCommand = async (
    root: string,
    remainingArgs: string[],
    format: OutputFormat
): Promise<CliRunResult> => {
    const showResult = await runShowCommand({
        storeRoot: root,
        args: remainingArgs,
    });
    if (!showResult.ok) {
        return formatError(toCliError('SHOW_FAILED', showResult.error.message, showResult.error));
    }
    const serialized = serializeOutput(showResult.value.output, format);
    if (!serialized.ok) {
        return formatError(toCliError('SHOW_FAILED', serialized.error.message, serialized.error));
    }
    return { exitCode: 0, output: serialized.value };
};

const executeRemoveCommand = async (
    root: string,
    remainingArgs: string[],
    _format: OutputFormat
): Promise<CliRunResult> => {
    const removeResult = await runRemoveCommand({
        storeRoot: root,
        args: remainingArgs,
    });
    if (!removeResult.ok) {
        return formatError(
            toCliError('REMOVE_FAILED', removeResult.error.message, removeResult.error)
        );
    }
    return { exitCode: 0, output: removeResult.value.message };
};

const executeMoveCommand = async (
    root: string,
    remainingArgs: string[],
    _format: OutputFormat
): Promise<CliRunResult> => {
    const moveResult = await runMoveCommand({
        storeRoot: root,
        args: remainingArgs,
    });
    if (!moveResult.ok) {
        return formatError(toCliError('MOVE_FAILED', moveResult.error.message, moveResult.error));
    }
    return { exitCode: 0, output: moveResult.value.message };
};

const runCommandWithStore = async (
    args: string[],
    cwd: string,
    globalStorePath: string,
    config: CortexConfig,
    command: StoreCommand
): Promise<CliRunResult> => {
    const storeRootResult = await resolveStoreRoot(args, cwd, globalStorePath);
    if (!storeRootResult.ok) {
        return formatError(storeRootResult.error);
    }
    const root = storeRootResult.value.root;
    const remainingArgs = storeRootResult.value.remainingArgs;
    const outputFormat: OutputFormat = config.outputFormat ?? 'yaml';

    const handlers: Record<
        StoreCommand,
        (root: string, args: string[], format: OutputFormat) => Promise<CliRunResult>
    > = {
        reindex: executeReindexCommand,
        add: executeAddCommand,
        update: executeUpdateCommand,
        list: executeListCommand,
        prune: executePruneCommand,
        show: executeShowCommand,
        remove: executeRemoveCommand,
        move: executeMoveCommand,
    };

    return handlers[command](root, remainingArgs, outputFormat);
};

export const runCli = async (options: CliRunOptions = {}): Promise<CliRunResult> => {
    const args = options.args ?? process.argv.slice(2);
    const cwd = options.cwd ?? process.cwd();

    // Parse --help flag first (highest priority)
    const helpFlag = parseHelpFlag(args);
    if (helpFlag.hasHelp) {
        // Parse global store to get remaining args without it
        const globalStoreFlag = parseGlobalStorePath(helpFlag.remaining);
        const [command] = globalStoreFlag.remaining;

        if (!command) {
            return { exitCode: 0, output: MAIN_HELP };
        }

        const commandHelp = COMMAND_HELP[command];
        if (!commandHelp) {
            return formatError(
                toCliError(
                    'INVALID_COMMAND',
                    `Unknown command: ${command}. Run 'cortex --help' for available commands.`
                )
            );
        }

        return { exitCode: 0, output: commandHelp };
    }

    // Load configuration early
    const configResult = await loadConfig({ cwd });
    if (!configResult.ok) {
        return formatError(
            toCliError(
                'CONFIG_LOAD_FAILED',
                `Failed to load config: ${configResult.error.message}`,
                configResult.error
            )
        );
    }
    const config = configResult.value;
    const outputFormat: OutputFormat = config.outputFormat ?? 'yaml';

    const globalStoreFlag = parseGlobalStorePath(args);
    const remainingArgs = globalStoreFlag.remaining;
    if (globalStoreFlag.globalStorePath === '') {
        return formatError(toCliError('INVALID_COMMAND', '--global-store requires a value.'));
    }
    const cortexConfigDir = resolve(homedir(), '.config', 'cortex');
    const globalStorePath =
        globalStoreFlag.globalStorePath ??
        options.globalStorePath ??
        resolve(cortexConfigDir, '.cortex');

    const [command, ...rest] = remainingArgs;
    if (!command) {
        return formatError(
            toCliError(
                'INVALID_COMMAND',
                "No command provided. Run 'cortex --help' for available commands."
            )
        );
    }

    // Handle legacy help command (no store required)
    if (command === 'help') {
        const helpResult = runHelpCommand({ args: rest });
        if (!helpResult.ok) {
            return formatError(
                toCliError('HELP_FAILED', helpResult.error.message, helpResult.error)
            );
        }
        return { exitCode: 0, output: helpResult.value.message };
    }

    // Handle store management command (no store required)
    if (command === 'store') {
        const registryPath = resolve(cortexConfigDir, 'stores.yaml');
        const storeResult = await runStoreCommand({
            args: rest,
            cwd,
            registryPath,
        });
        if (!storeResult.ok) {
            return formatError(
                toCliError('STORE_COMMAND_FAILED', storeResult.error.message, storeResult.error)
            );
        }
        const serialized = serializeOutput(storeResult.value.output, outputFormat);
        if (!serialized.ok) {
            return formatError(
                toCliError('STORE_COMMAND_FAILED', serialized.error.message, serialized.error)
            );
        }
        return { exitCode: 0, output: serialized.value };
    }

    // Handle init command (no store required - creates global config store)
    if (command === 'init') {
        const initResult = await runInitCommand({
            args: rest,
            cwd,
        });
        if (!initResult.ok) {
            return formatError(
                toCliError('INIT_FAILED', initResult.error.message, initResult.error)
            );
        }
        const serialized = serializeOutput(initResult.value.output, outputFormat);
        if (!serialized.ok) {
            return formatError(
                toCliError('INIT_FAILED', serialized.error.message, serialized.error)
            );
        }
        return { exitCode: 0, output: serialized.value };
    }

    const storeCommands = new Set<StoreCommand>([
        'reindex',
        'add',
        'update',
        'list',
        'prune',
        'show',
        'remove',
        'move',
    ]);
    if (storeCommands.has(command as StoreCommand)) {
        return runCommandWithStore(rest, cwd, globalStorePath, config, command as StoreCommand);
    }

    return formatError(
        toCliError(
            'INVALID_COMMAND',
            `Unknown command: ${command}. Run 'cortex --help' for available commands.`
        )
    );
};
