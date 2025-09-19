import { expect } from 'vitest';

/**
 * Vitest setup file to configure snapshot serializers for normalizing
 * absolute file paths to relative paths, ensuring snapshots work across
 * different development environments (local vs CI).
 */

// Add snapshot serializer for strings containing absolute file paths
expect.addSnapshotSerializer({
  test: (value) => {
    return typeof value === 'string' && (
      value.includes('/home/') ||
      value.includes('/Users/') ||
      value.includes('C:\\') ||
      value.includes('D:\\')
    );
  },
  serialize: (value, config, indentation, depth, refs, printer) => {
    if (typeof value !== 'string') {
      return printer(value, config, indentation, depth, refs);
    }

    let normalized = value;

    // Normalize local development paths (/home/username/repos/gen/...)
    normalized = normalized.replace(
      /\/home\/[^/]+\/repos\/gen\//g,
      './'
    );

    // Normalize CI paths (/home/runner/work/fluent-gen/fluent-gen/...)
    normalized = normalized.replace(
      /\/home\/runner\/work\/fluent-gen\/fluent-gen\//g,
      './'
    );

    // Normalize Windows paths (C:\path\to\fluent-gen\...)
    normalized = normalized.replace(
      /[A-Z]:\\[^\\]*\\fluent-gen\\/gi,
      './'
    );

    // Normalize macOS paths (/Users/username/.../fluent-gen/...)
    normalized = normalized.replace(
      /\/Users\/[^/]+\/[^/]*fluent-gen\//g,
      './'
    );

    // Generic fallback for any path containing fluent-gen
    normalized = normalized.replace(
      /\/[^/\s"']*\/fluent-gen\//g,
      './'
    );

    // Clean up any resulting double dots/slashes
    normalized = normalized.replace(/\/\.\//g, './');

    return printer(normalized, config, indentation, depth, refs);
  },
});

// Add snapshot serializer for objects that might contain file paths as properties
expect.addSnapshotSerializer({
  test: (value) => {
    return (
      value &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.values(value).some((v) =>
        typeof v === 'string' && (
          v.includes('/home/') ||
          v.includes('/Users/') ||
          v.includes('C:\\') ||
          v.includes('D:\\')
        )
      )
    );
  },
  serialize: (value, config, indentation, depth, refs, printer) => {
    const normalizedObject = { ...value };

    // Normalize any string properties that contain absolute paths
    for (const [key, val] of Object.entries(normalizedObject)) {
      if (typeof val === 'string') {
        let normalized = val;

        // Apply the same normalization rules as above
        normalized = normalized.replace(/\/home\/[^/]+\/repos\/gen\//g, './');
        normalized = normalized.replace(/\/home\/runner\/work\/fluent-gen\/fluent-gen\//g, './');
        normalized = normalized.replace(/[A-Z]:\\[^\\]*\\fluent-gen\\/gi, './');
        normalized = normalized.replace(/\/Users\/[^/]+\/[^/]*fluent-gen\//g, './');
        normalized = normalized.replace(/\/[^/\s"']*\/fluent-gen\//g, './');
        normalized = normalized.replace(/\/\.\//g, './');

        normalizedObject[key] = normalized;
      }
    }

    return printer(normalizedObject, config, indentation, depth, refs);
  },
});