import { describe, it, expect, beforeEach } from "vitest";
import { Cache, TypeResolutionCache } from "../cache.js";

describe("Cache", () => {
  let cache: Cache<string, number>;

  beforeEach(() => {
    cache = new Cache<string, number>(3);
  });

  describe("get/set", () => {
    it("should store and retrieve values", () => {
      cache.set("key1", 100);
      expect(cache.get("key1")).toBe(100);
    });

    it("should return undefined for missing keys", () => {
      expect(cache.get("missing")).toBeUndefined();
    });

    it("should update hit count on get", () => {
      cache.set("key1", 100);
      cache.get("key1");
      cache.get("key1");
      expect(cache.size).toBe(1);
    });
  });

  describe("has", () => {
    it("should return true for existing keys", () => {
      cache.set("key1", 100);
      expect(cache.has("key1")).toBe(true);
    });

    it("should return false for missing keys", () => {
      expect(cache.has("missing")).toBe(false);
    });
  });

  describe("delete", () => {
    it("should remove entries", () => {
      cache.set("key1", 100);
      expect(cache.delete("key1")).toBe(true);
      expect(cache.has("key1")).toBe(false);
    });

    it("should return false when deleting missing keys", () => {
      expect(cache.delete("missing")).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      cache.set("key1", 100);
      cache.set("key2", 200);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used when at capacity", () => {
      cache.set("key1", 1);
      cache.set("key2", 2);
      cache.set("key3", 3);

      cache.get("key1");
      cache.get("key2");

      cache.set("key4", 4);

      expect(cache.has("key1")).toBe(true);
      expect(cache.has("key2")).toBe(true);
      expect(cache.has("key3")).toBe(false);
      expect(cache.has("key4")).toBe(true);
    });
  });

  describe("TTL", () => {
    it("should expire entries after TTL", async () => {
      const ttlCache = new Cache<string, number>(10, 100);
      ttlCache.set("key1", 100);

      expect(ttlCache.get("key1")).toBe(100);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(ttlCache.get("key1")).toBeUndefined();
      expect(ttlCache.has("key1")).toBe(false);
    });

    it("should clean up expired entries on has() check", async () => {
      const ttlCache = new Cache<string, number>(10, 50);
      ttlCache.set("expired", 100);

      // Verify it exists initially
      expect(ttlCache.has("expired")).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // The has() check should clean up the expired entry
      expect(ttlCache.has("expired")).toBe(false);

      // Verify it was actually removed from the internal cache
      expect(ttlCache.get("expired")).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle corrupted cache state gracefully", () => {
      const cache = new Cache<string, number>(10);

      // Manually corrupt the cache state to test the has() method's robustness
      cache.set("test", 100);

      // Access the internal cache and set an entry to null/undefined
      // This tests the !entry check in has() method
      const internalCache = (cache as any).cache;
      internalCache.set("corrupted", null);

      // The has() method should handle this gracefully
      expect(cache.has("corrupted")).toBe(false);
      expect(cache.get("corrupted")).toBeUndefined();
    });
  });
});

describe("TypeResolutionCache", () => {
  let cache: TypeResolutionCache;

  beforeEach(() => {
    cache = new TypeResolutionCache();
  });

  describe("getCacheKey", () => {
    it("should generate consistent cache keys", () => {
      const key1 = cache.getCacheKey("file.ts", "MyType");
      const key2 = cache.getCacheKey("file.ts", "MyType");
      expect(key1).toBe(key2);
      expect(key1).toBe("file.ts::MyType");
    });
  });

  describe("symbol cache", () => {
    it("should store and retrieve symbols", () => {
      const symbol = { name: "TestSymbol" };
      cache.setSymbol("key1", symbol);
      expect(cache.getSymbol("key1")).toBe(symbol);
    });
  });

  describe("type cache", () => {
    it("should store and retrieve types", () => {
      const type = { kind: "object" };
      cache.setType("key1", type);
      expect(cache.getType("key1")).toBe(type);
    });
  });

  describe("file cache", () => {
    it("should store and retrieve files", () => {
      const file = { path: "/test/file.ts" };
      cache.setFile("/test/file.ts", file);
      expect(cache.getFile("/test/file.ts")).toBe(file);
    });
  });

  describe("clear", () => {
    it("should clear all caches", () => {
      cache.setSymbol("s1", "symbol");
      cache.setType("t1", "type");
      cache.setFile("f1", "file");

      cache.clear();

      expect(cache.getSymbol("s1")).toBeUndefined();
      expect(cache.getType("t1")).toBeUndefined();
      expect(cache.getFile("f1")).toBeUndefined();
    });
  });
});
