# Contributing to fluent-gen

First off, thank you for considering contributing to fluent-gen! It's people like you that make fluent-gen such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title** for the issue to identify the problem
- **Describe the exact steps which reproduce the problem** in as many details as possible
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior
- **Explain which behavior you expected to see instead and why**
- **Include code samples** that demonstrate the issue

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please:

- **Use a clear and descriptive title** for the issue to identify the suggestion
- **Provide a step-by-step description of the suggested enhancement** in as many details as possible
- **Provide specific examples to demonstrate the steps** or point out the part of fluent-gen where the suggestion is related to
- **Describe the current behavior** and **explain which behavior you expected to see instead** and why
- **Explain why this enhancement would be useful** to most fluent-gen users

### Pull Requests

Please follow these steps to have your contribution considered by the maintainers:

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes (`pnpm test`)
5. Make sure your code has no lint errors (`pnpm lint`)
6. Ensure type checking passes (`pnpm typecheck`)
7. Issue that pull request!

## Development Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/your-username/fluent-gen.git
   cd fluent-gen
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a branch for your feature or fix:

   ```bash
   git checkout -b my-feature-branch
   ```

4. Make your changes and test them:

   ```bash
   pnpm test:watch  # Run tests in watch mode
   pnpm typecheck   # Check TypeScript types
   pnpm lint        # Run linting
   ```

5. Build the project to ensure it compiles:

   ```bash
   pnpm build
   ```

## Project Structure

```
fluent-gen/
├── src/
│   ├── cli/              # CLI implementation
│   ├── core/             # Core utilities (Result, Cache, Plugin system)
│   ├── gen/              # Code generation modules
│   ├── type-info/        # Type extraction and resolution
│   └── index.ts          # Library entry point
├── docs/                 # VitePress documentation
├── __tests__/            # Test files
└── rolldown.config.ts    # Build configuration
```

## Testing

- Write tests for any new functionality
- Tests are located in `__tests__` directories alongside source files
- Use descriptive test names that explain what is being tested
- Aim for high test coverage (we maintain >85% coverage)

Run tests with:

```bash
pnpm test              # Run all tests once
pnpm test:watch        # Run tests in watch mode
pnpm test:coverage     # Generate coverage report
```

## Code Style

This project uses:

- **TypeScript** with strict mode enabled
- **oxlint** for linting
- **Prettier** for code formatting (via your IDE)

Key principles:

- No `any`, `unknown` or `as` without explicit justification and type-guards
- Use `Result<T, E>` types instead of throwing errors
- Keep functions under 50 lines
- Keep files under 300 lines
- Write self-documenting code with clear variable names

## Documentation

- Update the README.md if you change functionality
- Add JSDoc comments to all exported functions and types
- Update the VitePress documentation for user-facing changes
- Include examples in documentation

## Commit Messages

We follow conventional commits specification:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only changes
- `style:` Changes that don't affect code meaning
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `perf:` Performance improvement
- `test:` Adding or updating tests
- `chore:` Changes to build process or auxiliary tools

Examples:

```
feat: add support for union types
fix: resolve circular dependency in type resolver
docs: update CLI usage examples
```

## Release Process

We use semantic versioning and automated releases:

1. Changes are merged to `main`
2. Maintainers create a release PR with version bumps
3. When merged, GitHub Actions automatically publishes to NPM
4. Documentation is automatically deployed to GitHub Pages

## Getting Help

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Join our community discussions on GitHub

## Recognition

Contributors will be recognized in:

- The project README
- Release notes
- Our documentation

Thank you for contributing to fluent-gen! 🎉

