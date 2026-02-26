import { McpError } from '@modelcontextprotocol/sdk/types.js';

/** Standard MCP tool response with text content */
export interface McpToolResponse {
    [key: string]: unknown;
    content: { type: 'text'; text: string }[];
}

export const textResponse = (content: string): McpToolResponse =>
    createResponse({ type: 'text', text: content });

export const jsonResponse = (content: string): McpToolResponse =>
    createResponse({ type: 'json', text: content });

export const errorResponse = (content: string): McpToolResponse =>
    createResponse({ type: 'text', text: `Error: ${content}` }, true);

/**
 * Wraps a tool handler so that McpError throws are converted to
 * tool-level error responses (isError: true) instead of JSON-RPC errors.
 * This gives MCP clients a consistent error format in the tool result.
 */
export const wrapToolHandler = <T>(
    handler: (input: T) => Promise<McpToolResponse>
): ((input: T) => Promise<McpToolResponse>) => {
    return async (input: T): Promise<McpToolResponse> => {
        try {
            return await handler(input);
        } catch (error) {
            if (error instanceof McpError) {
                return errorResponse(error.message);
            }
            throw error;
        }
    };
};

function createResponse(
    content: string | { type: 'text' | 'json'; text: string },
    isError = false
): McpToolResponse {
    const response: McpToolResponse = {
        content: [
            {
                type: 'text',
                text: typeof content === 'string' ? content : content.text,
            },
        ],
    };
    if (isError) {
        response.isError = true;
    }
    return response;
}
