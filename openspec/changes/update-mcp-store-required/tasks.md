## 1. Rename Default Store

- [ ] 1.1 Update `createServerConfigSchema` in `src/server/config.ts` to use `'default'` instead of `'global'`
- [ ] 1.2 Update documentation/comments referencing `'global'` store
- [ ] 1.3 Update tests that reference `'global'` store name

## 2. Make Store Parameter Required

- [ ] 2.1 Update `storeNameSchema` in `src/server/memory/tools.ts` to remove `.optional()`
- [ ] 2.2 Update all memory tool input schemas to require `store`
- [ ] 2.3 Update `resolveStoreRoot` to not use fallback (store always provided)
- [ ] 2.4 Update tool descriptions to indicate store is required
- [ ] 2.5 Update unit tests to always provide store parameter

## 3. Integration Testing

- [ ] 3.1 Verify all tools reject calls without store parameter
- [ ] 3.2 Verify tools work correctly with explicit store parameter
- [ ] 3.3 Test with both `'default'` and project store names

## 4. Documentation

- [ ] 4.1 Update memory skill to document required store parameter
- [ ] 4.2 Add guidance on how agents should determine which store to use
