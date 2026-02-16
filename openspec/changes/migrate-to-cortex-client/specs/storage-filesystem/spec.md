## REMOVED Requirements

### Requirement: FilesystemRegistry

**Reason**: `FilesystemRegistry` is replaced by `Cortex.fromConfig()` which encapsulates filesystem-based config loading.

**Migration**: Replace `new FilesystemRegistry(path)` with `await Cortex.fromConfig(path)`.
