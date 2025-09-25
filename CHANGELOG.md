# fluent-gen-ts

## 0.1.5

### Patch Changes

- 4678d8d: Resolver and Import Generator refactor

## 0.1.4

### Patch Changes

- ba8d6b0: Dedup transient imports

## 0.1.3

### Patch Changes

- defb901: Support transient dependency discovery

## 0.1.2

### Patch Changes

- 1df08e9: Fix named external imports

## 0.1.1

### Patch Changes

- 296c594: Plugin system rework

  In this release we expose the new plugin system leveraging a fluent builder
  API, add support to file naming expressions and fix the types definition file
  in the bundle.

## 0.1.0

### Minor Changes

- 80054cd: Early adopters release

  This release marks the transition from experimental canaries to early adopter
  testing phase. While the core functionality is stable, the API may still
  evolve based on community feedback.

  ### What's Ready for Testing
  - Core fluent builder generation from TypeScript interfaces
  - CLI tool with interactive and batch modes
  - Basic TypeScript features support (generics, unions, utility types)
  - Plugin system foundation
  - Monorepo dependency resolution

  ### Known Limitations
  - API may change in future versions
  - Some advanced TypeScript patterns still being refined
  - Documentation and examples being expanded
  - Performance optimizations ongoing

  ### For Early Adopters

  Perfect for:
  - Prototyping and experimentation
  - Providing feedback on API design
  - Testing with real-world TypeScript codebases
  - Contributing to the project direction

  **Not recommended for production use yet** - wait for 1.0.0 for API stability
  guarantees.

  We welcome feedback, bug reports, and contributions as we work toward a stable
  1.0.0 release.
