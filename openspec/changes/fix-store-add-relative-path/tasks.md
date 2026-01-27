## 1. Implementation

- [x] 1.1 Add path resolution utility function that handles tilde expansion and relative path resolution
- [x] 1.2 Update `runStoreAddCommand` in `store.ts` to resolve paths before calling `runStoreAdd`
- [x] 1.3 Add unit tests for relative path resolution scenarios
- [x] 1.4 Add unit tests for tilde expansion
- [x] 1.5 Add unit tests for absolute path passthrough
- [x] 1.6 Update existing store add tests to verify absolute paths in output

## Review Findings Addressed

- [x] Normalize absolute paths consistently using `resolve()`
- [x] Add UNC path support for Windows network shares
- [x] Add test for standalone tilde (`~`) expansion
- [x] Move `homedir` import to top of test file
- [x] Add comprehensive JSDoc documentation with examples
