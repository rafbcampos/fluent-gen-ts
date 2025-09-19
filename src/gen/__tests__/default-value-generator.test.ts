import { describe, it, expect, beforeEach } from "vitest";
import { DefaultValueGenerator, type DefaultGeneratorConfig } from "../default-value-generator.js";
import { TypeKind, type TypeInfo } from "../../core/types.js";
import { PrimitiveType } from "../types.js";

describe("DefaultValueGenerator", () => {
  let generator: DefaultValueGenerator;

  beforeEach(() => {
    generator = new DefaultValueGenerator();
  });

  describe("generateDefaultsObject", () => {
    it("should return null when useDefaults is false", () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          { name: "test", type: { kind: TypeKind.Primitive, name: "string" }, optional: false, readonly: false },
        ],
      };

      const config: DefaultGeneratorConfig = { useDefaults: false };
      const result = generator.generateDefaultsObject(typeInfo, config);

      expect(result).toBeNull();
    });

    it("should return null for non-object types", () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Primitive,
        name: "string",
      };

      const config: DefaultGeneratorConfig = { useDefaults: true };
      const result = generator.generateDefaultsObject(typeInfo, config);

      expect(result).toBeNull();
    });

    it("should generate defaults for required properties", () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          { name: "id", type: { kind: TypeKind.Primitive, name: "string" }, optional: false, readonly: false },
          { name: "count", type: { kind: TypeKind.Primitive, name: "number" }, optional: false, readonly: false },
        ],
      };

      const config: DefaultGeneratorConfig = { useDefaults: true };
      const result = generator.generateDefaultsObject(typeInfo, config);

      expect(result).toBe('{ id: "", count: 0 }');
    });

    it("should skip optional properties", () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          { name: "required", type: { kind: TypeKind.Primitive, name: "string" }, optional: false, readonly: false },
          { name: "optional", type: { kind: TypeKind.Primitive, name: "number" }, optional: true, readonly: false },
        ],
      };

      const config: DefaultGeneratorConfig = { useDefaults: true };
      const result = generator.generateDefaultsObject(typeInfo, config);

      expect(result).toBe('{ required: "" }');
    });

    it("should skip object and reference types", () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          { name: "str", type: { kind: TypeKind.Primitive, name: "string" }, optional: false, readonly: false },
          { name: "obj", type: { kind: TypeKind.Object, properties: [] }, optional: false, readonly: false },
          { name: "ref", type: { kind: TypeKind.Reference, name: "User" }, optional: false, readonly: false },
        ],
      };

      const config: DefaultGeneratorConfig = { useDefaults: true };
      const result = generator.generateDefaultsObject(typeInfo, config);

      expect(result).toBe('{ str: "" }');
    });

    it("should handle hyphenated property names", () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          { name: "content-type", type: { kind: TypeKind.Primitive, name: "string" }, optional: false, readonly: false },
          { name: "x-auth-token", type: { kind: TypeKind.Primitive, name: "string" }, optional: false, readonly: false },
        ],
      };

      const config: DefaultGeneratorConfig = { useDefaults: true };
      const result = generator.generateDefaultsObject(typeInfo, config);

      expect(result).toBe('{ ["content-type"]: "", ["x-auth-token"]: "" }');
    });

    it("should return null when no defaults are generated", () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          { name: "optional", type: { kind: TypeKind.Primitive, name: "string" }, optional: true, readonly: false },
          { name: "obj", type: { kind: TypeKind.Object, properties: [] }, optional: false, readonly: false },
        ],
      };

      const config: DefaultGeneratorConfig = { useDefaults: true };
      const result = generator.generateDefaultsObject(typeInfo, config);

      expect(result).toBeNull();
    });
  });

  describe("getDefaultValueForType", () => {
    describe("primitive types", () => {
      it("should return empty string for string type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: PrimitiveType.String };
        expect(generator.getDefaultValueForType(typeInfo)).toBe('""');
      });

      it("should return 0 for number type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: PrimitiveType.Number };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("0");
      });

      it("should return false for boolean type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: PrimitiveType.Boolean };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("false");
      });

      it("should return BigInt(0) for bigint type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: PrimitiveType.BigInt };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("BigInt(0)");
      });

      it("should return Symbol() for symbol type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: PrimitiveType.Symbol };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("Symbol()");
      });

      it("should return undefined for undefined type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: PrimitiveType.Undefined };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("undefined");
      });

      it("should return undefined for null type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: PrimitiveType.Null };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("undefined");
      });

      it("should return undefined for void type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: PrimitiveType.Void };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("undefined");
      });

      it("should return undefined for never type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: PrimitiveType.Never };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("undefined");
      });

      it("should return undefined for any type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: PrimitiveType.Any };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("undefined");
      });

      it("should return undefined for unknown type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: PrimitiveType.Unknown };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("undefined");
      });

      it("should return undefined for unrecognized primitive", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: "unrecognized" };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("undefined");
      });
    });

    describe("array types", () => {
      it("should return empty array for array type", () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: "string" },
        };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("[]");
      });
    });

    describe("function types", () => {
      it("should return arrow function for function type", () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Function,
        };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("() => undefined");
      });
    });

    describe("literal types", () => {
      it("should return string literal with quotes", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Literal, literal: "hello" };
        expect(generator.getDefaultValueForType(typeInfo)).toBe('"hello"');
      });

      it("should return number literal as string", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Literal, literal: 42 };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("42");
      });

      it("should return boolean literal as string", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Literal, literal: true };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("true");
      });
    });

    describe("union types", () => {
      it("should pick first non-undefined type from union", () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Union,
          unionTypes: [
            { kind: TypeKind.Primitive, name: "undefined" },
            { kind: TypeKind.Primitive, name: "string" },
            { kind: TypeKind.Primitive, name: "number" },
          ],
        };
        expect(generator.getDefaultValueForType(typeInfo)).toBe('""');
      });

      it("should return undefined if all union types are undefined", () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Union,
          unionTypes: [
            { kind: TypeKind.Primitive, name: "undefined" },
            { kind: TypeKind.Primitive, name: "undefined" },
          ],
        };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("undefined");
      });

      it("should handle empty union", () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Union,
          unionTypes: [],
        };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("undefined");
      });

      it("should handle union without unionTypes array", () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Union,
        } as TypeInfo;
        expect(generator.getDefaultValueForType(typeInfo)).toBe("undefined");
      });

      it("should pick first literal from union", () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Union,
          unionTypes: [
            { kind: TypeKind.Literal, literal: "option1" },
            { kind: TypeKind.Literal, literal: "option2" },
          ],
        };
        expect(generator.getDefaultValueForType(typeInfo)).toBe('"option1"');
      });
    });

    describe("complex types", () => {
      it("should return empty object for object type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Object, properties: [] };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("{}");
      });

      it("should return empty object for reference type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Reference, name: "User" };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("{}");
      });

      it("should return undefined for generic type", () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Generic,
          name: "T",
        };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("undefined");
      });

      it("should return empty array for tuple type", () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Tuple,
          elementType: { kind: TypeKind.Primitive, name: "string" },
        };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("[]");
      });

      it("should return empty object for intersection type", () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Intersection,
          intersectionTypes: [
            { kind: TypeKind.Object, properties: [] },
            { kind: TypeKind.Object, properties: [] },
          ],
        };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("{}");
      });

      it("should return undefined for enum type", () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Enum,
          name: "Color",
        };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("undefined");
      });

      it("should return undefined for unknown type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Unknown };
        expect(generator.getDefaultValueForType(typeInfo)).toBe("undefined");
      });
    });

    describe("custom defaults", () => {
      it("should use custom default for matching primitive type", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: "string" };
        const config: DefaultGeneratorConfig = {
          useDefaults: true,
          customDefaults: new Map([
            ["string", () => '"custom-string"'],
          ]),
        };

        expect(generator.getDefaultValueForType(typeInfo, config)).toBe('"custom-string"');
      });

      it("should ignore custom defaults for non-primitive types", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Object, properties: [] };
        const config: DefaultGeneratorConfig = {
          useDefaults: true,
          customDefaults: new Map([
            ["Object", () => "{ custom: true }"],
          ]),
        };

        expect(generator.getDefaultValueForType(typeInfo, config)).toBe("{}");
      });

      it("should fallback to standard default if no custom match", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: "number" };
        const config: DefaultGeneratorConfig = {
          useDefaults: true,
          customDefaults: new Map([
            ["string", () => '"custom"'],
          ]),
        };

        expect(generator.getDefaultValueForType(typeInfo, config)).toBe("0");
      });

      it("should handle custom defaults returning complex expressions", () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: "Date" };
        const config: DefaultGeneratorConfig = {
          useDefaults: true,
          customDefaults: new Map([
            ["Date", () => "new Date()"],
          ]),
        };

        expect(generator.getDefaultValueForType(typeInfo, config)).toBe("new Date()");
      });
    });
  });

  describe("integration scenarios", () => {
    it("should handle complex nested type structures", () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: "id",
            type: { kind: TypeKind.Primitive, name: "string" },
            optional: false,
            readonly: false,
          },
          {
            name: "tags",
            type: {
              kind: TypeKind.Array,
              elementType: { kind: TypeKind.Primitive, name: "string" },
            },
            optional: false,
            readonly: false,
          },
          {
            name: "status",
            type: {
              kind: TypeKind.Union,
              unionTypes: [
                { kind: TypeKind.Literal, literal: "active" },
                { kind: TypeKind.Literal, literal: "inactive" },
              ],
            },
            optional: false,
            readonly: false,
          },
          {
            name: "metadata",
            type: { kind: TypeKind.Object, properties: [] },
            optional: false,
            readonly: false,
          },
          {
            name: "callback",
            type: {
              kind: TypeKind.Function,
            },
            optional: false,
            readonly: false,
          },
        ],
      };

      const config: DefaultGeneratorConfig = { useDefaults: true };
      const result = generator.generateDefaultsObject(typeInfo, config);

      expect(result).toBe('{ id: "", tags: [], status: "active", callback: () => undefined }');
    });

    it("should handle all primitive types", () => {
      const primitives = [
        PrimitiveType.String,
        PrimitiveType.Number,
        PrimitiveType.Boolean,
        PrimitiveType.BigInt,
        PrimitiveType.Symbol,
        PrimitiveType.Undefined,
        PrimitiveType.Null,
        PrimitiveType.Void,
        PrimitiveType.Never,
        PrimitiveType.Any,
        PrimitiveType.Unknown,
      ];

      primitives.forEach((primitive) => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: primitive };
        const result = generator.getDefaultValueForType(typeInfo);
        expect(typeof result).toBe("string");
      });
    });

    it("should handle readonly properties", () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: "readonlyProp",
            type: { kind: TypeKind.Primitive, name: "string" },
            optional: false,
            readonly: true,
          },
          {
            name: "mutableProp",
            type: { kind: TypeKind.Primitive, name: "number" },
            optional: false,
            readonly: false,
          },
        ],
      };

      const config: DefaultGeneratorConfig = { useDefaults: true };
      const result = generator.generateDefaultsObject(typeInfo, config);

      expect(result).toBe('{ readonlyProp: "", mutableProp: 0 }');
    });
  });
});