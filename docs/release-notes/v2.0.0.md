# Upcoming

## Changes

- Removed unused `commander` dependency — the published package is now smaller
- `typebox` is now a peer dependency instead of a direct dependency, avoiding duplicate installations
- Updated `typebox` peer dependency to `^1.1.6`
- Dropped CommonJS support — the package is now ESM-only
- Reduced published package size from ~40kB to ~7kB by excluding build artifacts
