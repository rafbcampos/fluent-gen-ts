import { describe, it, expect } from "vitest";
import { FluentGen } from "../gen/index.js";
import { TypeExtractor } from "../type-info/index.js";
import { isOk } from "../core/result.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("FluentGen Integration", () => {
  const fixturesPath = path.join(__dirname, "fixtures", "simple.ts");

  describe("TypeExtractor", () => {
    it("should extract simple interface", async () => {
      const extractor = new TypeExtractor();
      const result = await extractor.extractType(fixturesPath, "Address");

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toStrictEqual({
          ok: true,
          value: {
            dependencies: [],
            imports: [],
            name: "Address",
            sourceFile: expect.stringContaining(
              "/repos/gen/src/__tests__/fixtures/simple.ts",
            ),
            typeInfo: {
              kind: "object",
              name: "Address",
              properties: [
                {
                  name: "street",
                  optional: false,
                  readonly: false,
                  jsDoc: "Street name",
                  type: {
                    kind: "primitive",
                    name: "string",
                  },
                },
                {
                  name: "city",
                  optional: false,
                  readonly: false,
                  jsDoc: "City name",
                  type: {
                    kind: "primitive",
                    name: "string",
                  },
                },
                {
                  name: "country",
                  optional: false,
                  readonly: false,
                  jsDoc: "Country code",
                  type: {
                    kind: "primitive",
                    name: "string",
                  },
                },
              ],
            },
          },
        });
      }
    });

    it("should extract interface with nested types", async () => {
      const extractor = new TypeExtractor();
      const result = await extractor.extractType(fixturesPath, "User");

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toStrictEqual({
          ok: true,
          value: {
            dependencies: [],
            imports: [],
            name: "User",
            sourceFile: expect.stringMatching(
              "/repos/gen/src/__tests__/fixtures/simple.ts",
            ),
            typeInfo: {
              kind: "object",
              name: "User",
              properties: [
                {
                  name: "id",
                  optional: false,
                  readonly: false,
                  jsDoc: "Unique identifier",
                  type: {
                    kind: "primitive",
                    name: "string",
                  },
                },
                {
                  name: "name",
                  optional: false,
                  readonly: false,
                  jsDoc: "Full name",
                  type: {
                    kind: "primitive",
                    name: "string",
                  },
                },
                {
                  name: "age",
                  optional: true,
                  readonly: false,
                  jsDoc: "Age in years",
                  type: {
                    kind: "primitive",
                    name: "number",
                  },
                },
                {
                  name: "address",
                  optional: false,
                  readonly: false,
                  jsDoc: "User address",
                  type: {
                    kind: "object",
                    name: "Address",
                    properties: [
                      {
                        name: "street",
                        optional: false,
                        readonly: false,
                        jsDoc: "Street name",
                        type: {
                          kind: "primitive",
                          name: "string",
                        },
                      },
                      {
                        name: "city",
                        optional: false,
                        readonly: false,
                        jsDoc: "City name",
                        type: {
                          kind: "primitive",
                          name: "string",
                        },
                      },
                      {
                        name: "country",
                        optional: false,
                        readonly: false,
                        jsDoc: "Country code",
                        type: {
                          kind: "primitive",
                          name: "string",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        });
      }
    });

    it("should extract type alias", async () => {
      const extractor = new TypeExtractor();
      const result = await extractor.extractType(fixturesPath, "Point");

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toStrictEqual({
          ok: true,
          value: {
            dependencies: [],
            imports: [],
            name: "Point",
            sourceFile: expect.stringMatching(
              "/repos/gen/src/__tests__/fixtures/simple.ts",
            ),
            typeInfo: {
              kind: "object",
              name: "__type",
              properties: [
                {
                  name: "x",
                  optional: false,
                  readonly: false,
                  type: {
                    kind: "primitive",
                    name: "number",
                  },
                },
                {
                  name: "y",
                  optional: false,
                  readonly: false,
                  type: {
                    kind: "primitive",
                    name: "number",
                  },
                },
                {
                  name: "z",
                  optional: true,
                  readonly: false,
                  type: {
                    kind: "primitive",
                    name: "number",
                  },
                },
              ],
            },
          },
        });
      }
    });

    it("should scan file for types", async () => {
      const extractor = new TypeExtractor();
      const result = await extractor.scanFile(fixturesPath);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toStrictEqual({
          ok: true,
          value: ["Address", "User", "ApiResponse", "ComplexType", "Point"],
        });
      }
    });
  });

  describe("Builder Generation", () => {
    it("should generate builder for simple interface", async () => {
      const generator = new FluentGen({});

      const result = await generator.generateBuilder(fixturesPath, "Address");

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });

    it("should generate builder with optional properties", async () => {
      const generator = new FluentGen({});

      const result = await generator.generateBuilder(fixturesPath, "Point");

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });

    it("should generate builder with generics", async () => {
      const generator = new FluentGen({});

      const result = await generator.generateBuilder(
        fixturesPath,
        "ApiResponse",
      );

      expect(isOk(result)).toBe(true);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });

    it("should handle nested builders", async () => {
      const generator = new FluentGen({});

      const result = await generator.generateBuilder(fixturesPath, "User");

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });

    it("should generate multiple builders", async () => {
      const generator = new FluentGen({});

      const result = await generator.generateMultiple(fixturesPath, [
        "Address",
        "User",
        "Point",
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });
  });
});
