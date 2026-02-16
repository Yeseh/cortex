/**
 * Domain error to MCP error translation layer.
 *
 * This module provides utilities for converting internal domain errors
 * into MCP protocol errors that clients can understand. It maintains
 * a mapping from domain-specific error codes to standard MCP error codes.
 *
 * @module server/errors
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';

/**
 * Union of all domain error codes handled by the MCP server.
 *
 * Error codes are grouped by their source domain:
 *
 * **Config errors** - Configuration file reading/parsing failures:
 * - `CONFIG_READ_FAILED` - Could not read configuration file from disk
 * - `CONFIG_PARSE_FAILED` - Configuration file has invalid syntax
 * - `CONFIG_VALIDATION_FAILED` - Configuration values fail schema validation
 *
 * **Store resolution errors** - Memory store lookup failures:
 * - `LOCAL_STORE_MISSING` - Requested local store not found in registry
 * - `GLOBAL_STORE_MISSING` - Requested global store not found in registry
 * - `STORE_ACCESS_FAILED` - Store exists but cannot be accessed (permissions, etc.)
 *
 * **Store registry parse errors** - Registry file structure issues:
 * - `MISSING_STORES_SECTION` - Registry YAML missing required 'stores' key
 * - `INVALID_STORES_SECTION` - 'stores' section has wrong type (not an object)
 * - `INVALID_STORE_NAME` - Store name contains invalid characters
 * - `DUPLICATE_STORE_NAME` - Two stores have the same name
 * - `MISSING_STORE_PATH` - Store entry missing required 'path' field
 * - `INVALID_STORE_PATH` - Store path is not a valid filesystem path
 * - `UNEXPECTED_ENTRY` - Registry contains unrecognized fields
 *
 * **Store registry load errors** - Registry file access failures:
 * - `REGISTRY_READ_FAILED` - Could not read registry file from disk
 * - `REGISTRY_PARSE_FAILED` - Registry file has invalid YAML syntax
 * - `REGISTRY_MISSING` - Registry file does not exist
 *
 * **Store registry save errors** - Registry persistence failures:
 * - `REGISTRY_WRITE_FAILED` - Could not write registry file to disk
 * - `REGISTRY_SERIALIZE_FAILED` - Could not serialize registry to YAML
 *
 * **Store registry serialize errors** - Registry content issues:
 * - `EMPTY_REGISTRY` - Cannot save an empty registry
 *
 * **Memory validation errors** - Memory identity validation failures:
 * - `INVALID_SLUG` - Slug contains invalid characters (must be kebab-case)
 * - `INVALID_CATEGORY_DEPTH` - Category path does not meet minimum depth requirement (at least one category)
 * - `INVALID_SLUG_PATH` - Full slug path is malformed
 */
export type DomainErrorCode =
    // Config errors
    | 'CONFIG_READ_FAILED'
    | 'CONFIG_PARSE_FAILED'
    | 'CONFIG_VALIDATION_FAILED'
    // Store resolution errors
    | 'LOCAL_STORE_MISSING'
    | 'GLOBAL_STORE_MISSING'
    | 'STORE_ACCESS_FAILED'
    // Store registry parse errors
    | 'MISSING_STORES_SECTION'
    | 'INVALID_STORES_SECTION'
    | 'INVALID_STORE_NAME'
    | 'DUPLICATE_STORE_NAME'
    | 'MISSING_STORE_PATH'
    | 'INVALID_STORE_PATH'
    | 'UNEXPECTED_ENTRY'
    // Store registry load errors
    | 'REGISTRY_READ_FAILED'
    | 'REGISTRY_PARSE_FAILED'
    | 'REGISTRY_MISSING'
    // Store registry save errors
    | 'REGISTRY_WRITE_FAILED'
    | 'REGISTRY_SERIALIZE_FAILED'
    // Store registry serialize errors
    | 'EMPTY_REGISTRY'
    // Memory validation errors
    | 'INVALID_SLUG'
    | 'INVALID_CATEGORY_DEPTH'
    | 'INVALID_SLUG_PATH';

/**
 * Mapping from domain error codes to MCP protocol error codes.
 *
 * This mapping determines how internal errors are presented to MCP clients:
 * - `InternalError` - Server-side failures (I/O, permissions)
 * - `InvalidRequest` - Malformed request structure
 * - `InvalidParams` - Invalid parameter values
 */
const errorCodeMapping: Record<DomainErrorCode, ErrorCode> = {
    // CONFIG_* errors → InternalError
    CONFIG_READ_FAILED: ErrorCode.InternalError,
    CONFIG_PARSE_FAILED: ErrorCode.InvalidRequest,
    CONFIG_VALIDATION_FAILED: ErrorCode.InvalidParams,

    // *_MISSING errors → InvalidParams
    LOCAL_STORE_MISSING: ErrorCode.InvalidParams,
    GLOBAL_STORE_MISSING: ErrorCode.InvalidParams,
    REGISTRY_MISSING: ErrorCode.InvalidParams,

    // STORE_ACCESS_FAILED → InternalError
    STORE_ACCESS_FAILED: ErrorCode.InternalError,

    // Store registry parse errors
    MISSING_STORES_SECTION: ErrorCode.InvalidRequest,
    INVALID_STORES_SECTION: ErrorCode.InvalidRequest,
    INVALID_STORE_NAME: ErrorCode.InvalidParams,
    DUPLICATE_STORE_NAME: ErrorCode.InvalidParams,
    MISSING_STORE_PATH: ErrorCode.InvalidParams,
    INVALID_STORE_PATH: ErrorCode.InvalidParams,
    UNEXPECTED_ENTRY: ErrorCode.InvalidRequest,

    // Store registry load errors
    REGISTRY_READ_FAILED: ErrorCode.InternalError,
    REGISTRY_PARSE_FAILED: ErrorCode.InvalidRequest,

    // Store registry save errors
    REGISTRY_WRITE_FAILED: ErrorCode.InternalError,
    REGISTRY_SERIALIZE_FAILED: ErrorCode.InternalError,

    // Store registry serialize errors
    EMPTY_REGISTRY: ErrorCode.InvalidParams,

    // INVALID_* errors → InvalidParams
    INVALID_SLUG: ErrorCode.InvalidParams,
    INVALID_CATEGORY_DEPTH: ErrorCode.InvalidParams,
    INVALID_SLUG_PATH: ErrorCode.InvalidParams,
};

/**
 * Converts a domain error code and message to an MCP protocol error.
 *
 * Uses the internal error code mapping to determine the appropriate
 * MCP error code. Falls back to `InternalError` for unmapped codes.
 *
 * @param code - The domain-specific error code
 * @param message - Human-readable error description
 * @returns MCP error suitable for protocol response
 *
 * @example
 * ```ts
 * const mcpError = domainErrorToMcpError('INVALID_SLUG', 'Slug must be kebab-case');
 * // Returns: McpError with code InvalidParams
 * ```
 */
export const domainErrorToMcpError = (code: DomainErrorCode, message: string): McpError => {
    const mcpCode = errorCodeMapping[code] ?? ErrorCode.InternalError;
    return new McpError(mcpCode, message);
};

/**
 * Converts a Zod validation error to an MCP protocol error.
 *
 * Formats all validation issues into a semicolon-separated message
 * showing the field path and error message for each issue.
 *
 * @param error - Zod validation error with issue details
 * @returns MCP error with `InvalidParams` code
 *
 * @example
 * ```ts
 * const schema = z.object({ name: z.string() });
 * const result = schema.safeParse({ name: 123 });
 * if (!result.success) {
 *   const mcpError = zodErrorToMcpError(result.error);
 *   // Message: "name: Expected string, received number"
 * }
 * ```
 */
export const zodErrorToMcpError = (error: z.ZodError): McpError => {
    const message = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return new McpError(ErrorCode.InvalidParams, message);
};

/**
 * Handles any domain error with a `code` and `message` property.
 *
 * This is the primary error handler for MCP tool implementations.
 * It checks if the error code is a known domain error and maps it
 * appropriately, otherwise returns an internal error.
 *
 * @param error - Domain error object with code and message
 * @returns MCP error suitable for protocol response
 *
 * @example
 * ```ts
 * const cortex = await Cortex.fromConfig(configPath);
 * if (!cortex.ok()) {
 *   throw handleDomainError(cortex.error);
 * }
 * ```
 */
export const handleDomainError = <E extends { code: string; message: string }>(
    error: E
): McpError => {
    if (error.code in errorCodeMapping) {
        return domainErrorToMcpError(error.code as DomainErrorCode, error.message);
    }
    return new McpError(ErrorCode.InternalError, error.message);
};
