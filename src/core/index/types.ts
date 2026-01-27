/**
 * Index types for category indexes
 */

export interface IndexMemoryEntry {
    path: string;
    tokenEstimate: number;
    summary?: string;
}

export interface IndexSubcategoryEntry {
    path: string;
    memoryCount: number;
    description?: string; // Max 500 chars, optional
}

export interface CategoryIndex {
    memories: IndexMemoryEntry[];
    subcategories: IndexSubcategoryEntry[];
}

export type IndexParseErrorCode =
    | 'INVALID_FORMAT'
    | 'INVALID_SECTION'
    | 'INVALID_ENTRY'
    | 'MISSING_FIELD'
    | 'INVALID_NUMBER';

export interface IndexParseError {
    code: IndexParseErrorCode;
    message: string;
    line?: number;
    field?: string;
}

export type IndexSerializeErrorCode = 'INVALID_ENTRY' | 'INVALID_NUMBER';

export interface IndexSerializeError {
    code: IndexSerializeErrorCode;
    message: string;
    field?: string;
}
