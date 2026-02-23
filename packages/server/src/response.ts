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

function createResponse(
    content: string | { type: 'text' | 'json'; text: string },
    isError = false,
): McpToolResponse {
    const response: McpToolResponse = {
        content: [{
            type: 'text',
            text: typeof content === 'string' ? content : content.text,
        }],
    };
    if (isError) {
        response.isError = true;
    }
    return response;
}
