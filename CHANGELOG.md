# fluent-gen-ts

## 0.1.22

### Patch Changes

- 2ac4dfa: Fix extended methods extraction

## 0.1.21

### Patch Changes

- 803fd9b: Fix issue with undefined initial values

## 0.1.20

### Patch Changes

- e356bae: Expose the when method to addMethod

## 0.1.19

### Patch Changes

- 7bb98a1: Conditional addMethod

## 0.1.18

### Patch Changes

- 8d68973: Factory naming config

## 0.1.17

### Patch Changes

- 22c3a6e: Improve typescript-only types detection

## 0.1.16

### Patch Changes

- 44688ca: Fix hyphenated property names

## 0.1.15

### Patch Changes

- bf74502: Increate test coverage and docs

## 0.1.14

### Patch Changes

- ab101c3: Fix nested builder detection on plugins

## 0.1.13

### Patch Changes

- 0a71212: Fix issues with deep transform API

## 0.1.12

### Patch Changes

- 5183453: Missing plugin exports

## 0.1.11

### Patch Changes

- 3cbb2f8: Deep transformers

## 0.1.10

### Patch Changes

- aedf3ad: Builder-utilities refactor

## 0.1.9

### Patch Changes

- 5251c27: Fix ESM config import

## 0.1.8

### Patch Changes

- 6e8b912: Complete refactor

## 0.1.7

### Patch Changes

- f986e84: New import data type

## 0.1.6

### Patch Changes

- f34d23e: Barrel exports

## 0.1.5

### Patch Changes

- c2c7524: Resolver and Generate Import refactor

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
