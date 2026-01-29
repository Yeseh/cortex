## 1. Rename Default Store

- [x] 1.1 Update `createServerConfigSchema` in `src/server/config.ts` to use `'default'` instead of `'global'`
- [x] 1.2 Update documentation/comments referencing `'global'` store
- [x] 1.3 Update tests that reference `'global'` store name

## 2. Make Store Parameter Required

- [x] 2.1 Update `storeNameSchema` in `src/server/memory/tools.ts` to remove `.optional()`
- [x] 2.2 Update all memory tool input schemas to require `store`
- [x] 2.3 Update `resolveStoreRoot` to not use fallback (store always provided)
- [x] 2.4 Update tool descriptions to indicate store is required
- [x] 2.5 Update unit tests to always provide store parameter

## 3. Integration Testing

- [x] 3.1 Verify all tools reject calls without store parameter
- [x] 3.2 Verify tools work correctly with explicit store parameter
- [x] 3.3 Test with both `'default'` and project store names

## 4. Documentation

- [x] 4.1 Update memory skill to document required store parameter
- [x] 4.2 Add guidance on how agents should determine which store to use
