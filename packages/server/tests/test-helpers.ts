import { afterEach, expect } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export interface ServerSandbox {
    rootDir: string;
    homeDir: string;
    dataPath: string;
    port: number;
    host: string;
    baseUrl: string;
    defaultStore: string;
}

export interface StartedServer {
    process: ChildProcessWithoutNullStreams;
    stderr: string;
    stdout: string;
    baseUrl: string;
}

export interface JsonRpcSuccess<T = unknown> {
    jsonrpc: '2.0';
    id: string | number | null;
    result: T;
}

export interface JsonRpcError {
    jsonrpc: '2.0';
    id: string | number | null;
    error: {
        code: number;
        message: string;
        data?: unknown;
    };
}

export interface McpHttpResponse {
    status: number;
    body: JsonRpcSuccess | JsonRpcError | Record<string, unknown>;
}

const TEST_CLIENT_INFO = {
    name: 'cortex-integration-tests',
    version: '1.0.0',
};

const sessionIdsByBaseUrl = new Map<string, string>();

export const createServerSandbox = async (defaultStore = 'global'): Promise<ServerSandbox> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'cortex-server-int-'));
    const homeDir = join(rootDir, 'home');
    const dataPath = join(rootDir, 'data');
    const host = '127.0.0.1';
    const port = await getFreePort();

    return {
        rootDir,
        homeDir,
        dataPath,
        port,
        host,
        baseUrl: `http://${host}:${port}`,
        defaultStore,
    };
};

export const registerSandboxCleanup = (sandbox: ServerSandbox): void => {
    afterEach(async () => {
        await rm(sandbox.rootDir, { recursive: true, force: true });
    });
};

export const startServer = async (sandbox: ServerSandbox): Promise<StartedServer> => {
    const serverRoot = fileURLToPath(new URL('..', import.meta.url));
    const child = spawn('bun', [
        'run', 'src/index.ts',
    ], {
        cwd: serverRoot,
        env: {
            ...process.env,
            HOME: sandbox.homeDir,
            CORTEX_DATA_PATH: sandbox.dataPath,
            CORTEX_PORT: String(sandbox.port),
            CORTEX_HOST: sandbox.host,
            CORTEX_DEFAULT_STORE: sandbox.defaultStore,
        },
        stdio: 'pipe',
    });

    let stderr = '';
    let stdout = '';

    child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
    });
    child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
    });

    await waitForHealth(sandbox.baseUrl, 8_000, child, () => stderr);

    return {
        process: child,
        stderr,
        stdout,
        baseUrl: sandbox.baseUrl,
    };
};

export const stopServer = async (proc: StartedServer, timeoutMs = 4_000): Promise<void> => {
    if (!proc?.process) {
        return;
    }

    if (proc.process.exitCode !== null) {
        return;
    }

    proc.process.kill('SIGTERM');

    await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
            if (proc.process.exitCode === null) {
                proc.process.kill('SIGKILL');
            }
            resolve();
        }, timeoutMs);

        proc.process.once('exit', () => {
            clearTimeout(timeout);
            resolve();
        });
    });
};

export const waitForHealth = async (
    baseUrl: string,
    timeoutMs: number,
    child?: ChildProcessWithoutNullStreams,
    getStderr?: () => string,
): Promise<void> => {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        try {
            const response = await fetch(`${baseUrl}/health`);
            if (response.status === 200) {
                return;
            }
        }
        catch {
            // polling until ready
        }

        if (child && child.exitCode !== null) {
            throw new Error(
                `Server exited before becoming healthy (exit ${child.exitCode}).\n${getStderr?.() ?? ''}`,
            );
        }

        await sleep(100);
    }

    throw new Error(`Server did not become healthy within ${timeoutMs}ms.\n${getStderr?.() ?? ''}`);
};

export const postMcp = async (
    baseUrl: string,
    method: string,
    params: Record<string, unknown> = {},
    id: string | number = 1,
): Promise<McpHttpResponse> => {
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
    };

    const sessionId = sessionIdsByBaseUrl.get(baseUrl);
    if (sessionId) {
        headers['mcp-session-id'] = sessionId;
    }

    const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            method,
            params,
        }),
    });

    const responseSessionId = response.headers.get('mcp-session-id');
    if (responseSessionId) {
        sessionIdsByBaseUrl.set(baseUrl, responseSessionId);
    }

    const rawBody = await response.text();
    const body = parseMcpBody(rawBody);
    return { status: response.status, body };
};

export const initializeMcp = async (baseUrl: string): Promise<McpHttpResponse> => {
    return postMcp(baseUrl, 'initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: TEST_CLIENT_INFO,
    });
};

export const listTools = async (baseUrl: string): Promise<McpHttpResponse> => {
    return postMcp(baseUrl, 'tools/list', {}, 2);
};

export const callTool = async (
    baseUrl: string,
    name: string,
    args: Record<string, unknown>,
    id: string | number = 3,
): Promise<McpHttpResponse> => {
    return postMcp(
        baseUrl,
        'tools/call',
        {
            name,
            arguments: args,
        },
        id,
    );
};

export const expectMcpSuccess = <T = unknown>(response: McpHttpResponse): JsonRpcSuccess<T> => {
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('jsonrpc', '2.0');

    if ('error' in response.body) {
        const protocolError = response.body as JsonRpcError;
        throw new Error(
            `Expected MCP success response with result, but got protocol error: ${protocolError.error.message}`
        );
    }

    expect(response.body).toHaveProperty('result');
    return response.body as JsonRpcSuccess<T>;
};

export const expectMcpError = (
    response: McpHttpResponse,
    messageContains?: string,
): JsonRpcError => {
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('jsonrpc', '2.0');

    if ('result' in response.body) {
        throw new Error(
            'Expected MCP protocol error response, but got a success result envelope. Use expectMcpToolError for tool-level errors.'
        );
    }

    expect(response.body).toHaveProperty('error');

    const body = response.body as JsonRpcError;
    if (messageContains) {
        expect(body.error.message).toContain(messageContains);
    }

    return body;
};

export const expectMcpToolError = (
    response: McpHttpResponse,
    messageContains?: string,
): JsonRpcSuccess => {
    const body = expectMcpSuccess(response);
    const result = body.result as { isError?: boolean };
    expect(result.isError).toBe(true);

    const text = readTextContent(body);
    if (messageContains) {
        expect(text).toContain(messageContains);
    }

    return body;
};

export const readTextContent = (response: JsonRpcSuccess): string => {
    const result = response.result as {
        content?: { type: string; text: string }[];
    };

    if (!result.content?.length) {
        return '';
    }

    return result.content[0]?.text ?? '';
};

const getFreePort = async (): Promise<number> => {
    const server = createServer();

    return new Promise<number>((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                reject(new Error('Failed to allocate free port'));
                return;
            }

            const port = address.port;
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(port);
            });
        });

        server.on('error', reject);
    });
};

const sleep = async (ms: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

const parseMcpBody = (body: string): JsonRpcSuccess | JsonRpcError | Record<string, unknown> => {
    const trimmed = body.trim();
    if (!trimmed) {
        return {};
    }

    try {
        return JSON.parse(trimmed) as JsonRpcSuccess | JsonRpcError;
    }
    catch {
        const dataLines = trimmed
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.startsWith('data:'));

        if (dataLines.length === 0) {
            throw new Error(`Failed to parse MCP response body: ${trimmed.slice(0, 300)}`);
        }

        const payload = dataLines[dataLines.length - 1]!.slice('data:'.length).trim();
        return JSON.parse(payload) as JsonRpcSuccess | JsonRpcError;
    }
};
