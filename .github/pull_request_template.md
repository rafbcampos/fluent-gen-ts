## Description

<!-- Provide a brief description of the changes in this PR -->

## Type of Change

<!-- Mark the relevant option with an [x] -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality
      to not work as expected)
- [ ] 📖 Documentation update
- [ ] 🔧 Refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test improvement
- [ ] 🔄 CI/CD improvement

## Related Issues

<!-- Link to any related issues -->

Fixes #(issue number) Closes #(issue number) Related to #(issue number)

## Changes Made

<!-- List the main changes made in this PR -->

-
-
-

## Testing

<!-- Describe the tests you ran and how to reproduce them -->

- [ ] All existing tests pass
- [ ] Added new tests for changes (if applicable)
- [ ] Manual testing completed
- [ ] TypeScript compilation succeeds

### Test Commands

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Example Usage

<!-- If applicable, provide example usage of the new feature or changes -->

```typescript
// Example usage here
interface User {
  id: string;
  name: string;
}

const user = userBuilder().withId('123').withName('John').build();
```

## Breaking Changes

<!-- If this is a breaking change, describe what changes users need to make -->

- [ ] No breaking changes
- [ ] Breaking changes described below

<!-- If breaking changes, describe them here -->

## Documentation

<!-- How does this change affect documentation? -->

- [ ] No documentation changes needed
- [ ] Documentation updated in this PR
- [ ] Documentation will be updated in a separate PR
- [ ] Documentation update issue created: #(issue number)

## Performance Impact

<!-- Describe any performance implications -->

- [ ] No performance impact
- [ ] Performance improved
- [ ] Performance may be impacted (explained below)

<!-- If performance impact, explain here -->

## Checklist

<!-- Check all that apply -->

- [ ] I have read the [contributing guidelines](CONTRIBUTING.md)
- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings or errors
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Screenshots

<!-- If applicable, add screenshots to help explain your changes -->

## Additional Notes

<!-- Add any other context about the PR here -->
