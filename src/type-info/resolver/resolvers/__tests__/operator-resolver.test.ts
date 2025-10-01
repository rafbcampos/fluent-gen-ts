import { describe, it, expect, vi } from 'vitest';
import { OperatorResolver } from '../operator-resolver.js';
import { TypeKind } from '../../../../core/types.js';
import type { Type } from 'ts-morph';
import { ts } from 'ts-morph';

describe('OperatorResolver', () => {
  describe('isKeyofType', () => {
    it('should return true for types with Index flag', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        compilerType: {
          flags: ts.TypeFlags.Index,
        },
      } as unknown as Type;

      const result = resolver.isKeyofType(mockType);
      expect(result).toBe(true);
    });

    it('should return false for types without Index flag', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        compilerType: {
          flags: ts.TypeFlags.String,
        },
      } as unknown as Type;

      const result = resolver.isKeyofType(mockType);
      expect(result).toBe(false);
    });

    it('should return false for types with no flags', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        compilerType: {},
      } as unknown as Type;

      const result = resolver.isKeyofType(mockType);
      expect(result).toBe(false);
    });

    it('should return false for types with no compilerType', () => {
      const resolver = new OperatorResolver();

      const mockType = {} as Type;

      const result = resolver.isKeyofType(mockType);
      expect(result).toBe(false);
    });
  });

  describe('isTypeofType', () => {
    it('should return true for types starting with "typeof "', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getSymbol: vi.fn().mockReturnValue(undefined),
        getText: vi.fn().mockReturnValue('typeof MyClass'),
      } as unknown as Type;

      const result = resolver.isTypeofType(mockType);
      expect(result).toBe(true);
    });

    it('should return true for types with symbol name starting with "typeof "', () => {
      const resolver = new OperatorResolver();

      const mockSymbol = {
        getName: vi.fn().mockReturnValue('typeof MyClass'),
      };

      const mockType = {
        getSymbol: vi.fn().mockReturnValue(mockSymbol),
        getText: vi.fn().mockReturnValue('SomeType'),
      } as unknown as Type;

      const result = resolver.isTypeofType(mockType);
      expect(result).toBe(true);
    });

    it('should return false for regular types', () => {
      const resolver = new OperatorResolver();

      const mockSymbol = {
        getName: vi.fn().mockReturnValue('MyClass'),
      };

      const mockType = {
        getSymbol: vi.fn().mockReturnValue(mockSymbol),
        getText: vi.fn().mockReturnValue('string'),
      } as unknown as Type;

      const result = resolver.isTypeofType(mockType);
      expect(result).toBe(false);
    });

    it('should return false when symbol is undefined', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getSymbol: vi.fn().mockReturnValue(undefined),
        getText: vi.fn().mockReturnValue('string'),
      } as unknown as Type;

      const result = resolver.isTypeofType(mockType);
      expect(result).toBe(false);
    });
  });

  describe('isIndexAccessType', () => {
    it('should return true for types with IndexedAccess flag', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        compilerType: {
          flags: ts.TypeFlags.IndexedAccess,
        },
      } as unknown as Type;

      const result = resolver.isIndexAccessType(mockType);
      expect(result).toBe(true);
    });

    it('should return false for types without IndexedAccess flag', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        compilerType: {
          flags: ts.TypeFlags.String,
        },
      } as unknown as Type;

      const result = resolver.isIndexAccessType(mockType);
      expect(result).toBe(false);
    });

    it('should return false for types with no flags', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        compilerType: {},
      } as unknown as Type;

      const result = resolver.isIndexAccessType(mockType);
      expect(result).toBe(false);
    });
  });

  describe('resolveKeyof', () => {
    it('should resolve keyof type to TypeInfo', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('keyof User'),
      } as unknown as Type;

      const result = resolver.resolveKeyof({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Keyof,
          target: { kind: TypeKind.Reference, name: 'User' },
        });
      }
    });

    it('should resolve complex keyof type', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('keyof (User & Admin)'),
      } as unknown as Type;

      const result = resolver.resolveKeyof({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Keyof,
          target: { kind: TypeKind.Reference, name: '(User & Admin)' },
        });
      }
    });

    it('should return Unknown when keyof pattern does not match', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('string'),
      } as unknown as Type;

      const result = resolver.resolveKeyof({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Unknown,
        });
      }
    });

    it('should handle keyof with whitespace variations', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('keyof  MyType'),
      } as unknown as Type;

      const result = resolver.resolveKeyof({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Keyof,
          target: { kind: TypeKind.Reference, name: 'MyType' },
        });
      }
    });
  });

  describe('resolveTypeof', () => {
    it('should resolve typeof type to TypeInfo', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('typeof myObject'),
      } as unknown as Type;

      const result = resolver.resolveTypeof({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Typeof,
          target: { kind: TypeKind.Reference, name: 'myObject' },
        });
      }
    });

    it('should resolve complex typeof type', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('typeof MyClass.prototype'),
      } as unknown as Type;

      const result = resolver.resolveTypeof({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Typeof,
          target: { kind: TypeKind.Reference, name: 'MyClass.prototype' },
        });
      }
    });

    it('should return Unknown when typeof pattern does not match', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('number'),
      } as unknown as Type;

      const result = resolver.resolveTypeof({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Unknown,
        });
      }
    });

    it('should handle typeof with whitespace variations', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('typeof  config'),
      } as unknown as Type;

      const result = resolver.resolveTypeof({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Typeof,
          target: { kind: TypeKind.Reference, name: 'config' },
        });
      }
    });
  });

  describe('resolveIndexAccess', () => {
    it('should resolve indexed access type to TypeInfo', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('User["name"]'),
      } as unknown as Type;

      const result = resolver.resolveIndexAccess({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Index,
          object: { kind: TypeKind.Reference, name: 'User' },
          index: { kind: TypeKind.Reference, name: '"name"' },
        });
      }
    });

    it('should resolve indexed access with keyof', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('User[keyof User]'),
      } as unknown as Type;

      const result = resolver.resolveIndexAccess({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Index,
          object: { kind: TypeKind.Reference, name: 'User' },
          index: { kind: TypeKind.Reference, name: 'keyof User' },
        });
      }
    });

    it('should resolve indexed access with type parameter', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('T[K]'),
      } as unknown as Type;

      const result = resolver.resolveIndexAccess({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Index,
          object: { kind: TypeKind.Reference, name: 'T' },
          index: { kind: TypeKind.Reference, name: 'K' },
        });
      }
    });

    it('should handle complex object types in index access', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('(User & Admin)["role"]'),
      } as unknown as Type;

      const result = resolver.resolveIndexAccess({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Index,
          object: { kind: TypeKind.Reference, name: '(User & Admin)' },
          index: { kind: TypeKind.Reference, name: '"role"' },
        });
      }
    });

    it('should return Unknown when index access pattern does not match', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('string'),
      } as unknown as Type;

      const result = resolver.resolveIndexAccess({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Unknown,
        });
      }
    });

    it('should return Unknown when brackets are empty', () => {
      const resolver = new OperatorResolver();

      const mockType = {
        getText: vi.fn().mockReturnValue('User[]'),
      } as unknown as Type;

      const result = resolver.resolveIndexAccess({ type: mockType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Unknown,
        });
      }
    });
  });
});
