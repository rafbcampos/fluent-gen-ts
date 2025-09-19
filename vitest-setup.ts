import { expect } from "vitest";

/**
 * Setup file for Vitest to configure snapshot serializers
 * and normalize absolute file paths in snapshots.
 */

// Add snapshot serializer for strings containing absolute paths
expect.addSnapshotSerializer({
  test: (value) => {
    return (
      typeof value === "string" &&
      (value.includes("/home/") ||
        value.includes("/Users/") ||
        value.includes("C:\\") ||
        value.includes("D:\\"))
    );
  },
  serialize: (value, config, indentation, depth, refs, printer) => {
    if (typeof value !== "string") {
      return printer(value, config, indentation, depth, refs);
    }

    let normalized = value;

    // Handle local development paths (e.g., /home/user/repos/gen/...)
    normalized = normalized.replace(/\/home\/[^/]+\/repos\/gen\//g, "./");

    // Handle CI paths (e.g., /home/runner/work/fluent-gen/fluent-gen/...)
    normalized = normalized.replace(
      /\/home\/runner\/work\/fluent-gen\/fluent-gen\//g,
      "./",
    );

    // Handle Windows paths in CI or local
    normalized = normalized.replace(/[A-Z]:\\[^\\]*\\fluent-gen\\/g, "./");

    // Handle macOS paths
    normalized = normalized.replace(
      /\/Users\/[^/]+\/[^/]*\/fluent-gen\//g,
      "./",
    );

    // Handle any other absolute paths that might contain the project name
    normalized = normalized.replace(/\/[^/\s"']*\/fluent-gen\//g, "./");

    // Clean up any double slashes that might have been created
    normalized = normalized.replace(/\/\.\//g, "./");

    return `"${normalized}"`;
  },
});

// Add snapshot serializer for objects that might contain file paths in their string properties
expect.addSnapshotSerializer({
  test: (value) => {
    return (
      value &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.values(value).some(
        (v) =>
          typeof v === "string" &&
          (v.includes("/home/") ||
            v.includes("/Users/") ||
            v.includes("C:\\") ||
            v.includes("D:\\")),
      )
    );
  },
  serialize: (value, config, indentation, depth, refs, printer) => {
    const normalizedObject = { ...value };

    // Normalize any string properties that contain absolute paths
    for (const [key, val] of Object.entries(normalizedObject)) {
      if (typeof val === "string") {
        let normalized = val;

        // Handle local development paths
        normalized = normalized.replace(/\/home\/[^/]+\/repos\/gen\//g, "./");

        // Handle CI paths
        normalized = normalized.replace(
          /\/home\/runner\/work\/fluent-gen\/fluent-gen\//g,
          "./",
        );

        // Handle Windows paths
        normalized = normalized.replace(/[A-Z]:\\[^\\]*\\fluent-gen\\/g, "./");

        // Handle macOS paths
        normalized = normalized.replace(
          /\/Users\/[^/]+\/[^/]*\/fluent-gen\//g,
          "./",
        );

        // Handle any other absolute paths
        normalized = normalized.replace(/\/[^/\s"']*\/fluent-gen\//g, "./");

        // Clean up double slashes
        normalized = normalized.replace(/\/\.\//g, "./");

        normalizedObject[key] = normalized;
      }
    }

    return printer(normalizedObject, config, indentation, depth, refs);
  },
});

