import { describe, expect, test, mock, beforeEach } from "bun:test";

// --- Mocks ---

const mockUuid = "mock-uuid-123";
mock.module("../../util/UUID", () => ({
  generateUUID: () => mockUuid,
}));

// We use a modular mock for Drizzle to simulate the chaining API
// e.g. db.insert().values().onConflictDoUpdate().returning()
const dbMocks = {
  returning: mock(() => [] as any[]),
  onConflictDoUpdate: mock(() => ({ returning: dbMocks.returning })),
  values: mock(() => ({ onConflictDoUpdate: dbMocks.onConflictDoUpdate })),
  where: mock(() => {
    const chain = { 
      returning: dbMocks.returning, 
      orderBy: mock(() => ({ 
        limit: dbMocks.limit 
      })),
      limit: dbMocks.limit,
      // Make it thenable so 'await db.select...where(...)' works
      then: (resolve: any) => Promise.resolve(dbMocks.returning()).then(resolve)
    };
    return chain;
  }),
  set: mock(() => ({ where: dbMocks.where })),
  from: mock(() => ({ 
    where: dbMocks.where, 
    limit: dbMocks.limit,
    orderBy: mock(() => ({ 
      limit: dbMocks.limit 
    }))
  })),
  limit: mock(() => [] as any[]),
  select: mock(() => ({ from: dbMocks.from })),
  insert: mock(() => ({ values: dbMocks.values })),
  update: mock(() => ({ set: dbMocks.set })),
};

mock.module("../../infra/Drizzle", () => ({
  db: {
    insert: dbMocks.insert,
    update: dbMocks.update,
    select: dbMocks.select,
  },
}));

// IMPORT SERVICE AFTER MOCKS
import { TagService } from "./TagService";

// --- Tests ---

describe("TagService", () => {
  let service: TagService;

  beforeEach(() => {
    service = new TagService();
    // Reset all mock call history and implementations
    Object.values(dbMocks).forEach(m => m.mockClear());
    dbMocks.returning.mockImplementation(() => []);
    dbMocks.limit.mockImplementation(() => []);
  });

  describe("createTag", () => {
    test("should create and return a tag", async () => {
      const input = { name: "work", semantic: "office tasks", userId: "u1" };
      const dbResponse = { ...input, id: mockUuid, createdAt: new Date(), updatedAt: new Date() };
      
      dbMocks.returning.mockImplementation(() => [dbResponse]);

      const result = await service.createTag(input);

      expect(dbMocks.insert).toHaveBeenCalled();
      expect(result?.id).toBe(mockUuid);
      expect(result?.name).toBe("work");
    });

    test("should return null if insertion fails", async () => {
      dbMocks.returning.mockImplementation(() => []);
      const result = await service.createTag({ name: "x", semantic: "y", userId: "z" });
      expect(result).toBeNull();
    });
  });

  describe("updateTag", () => {
    test("should update existing tag fields", async () => {
      const dbResponse = { id: "t1", name: "new-name", userId: "u1", updatedAt: new Date() };
      dbMocks.returning.mockImplementation(() => [dbResponse]);

      const result = await service.updateTag({ id: "t1", userId: "u1", name: "new-name" });

      expect(dbMocks.update).toHaveBeenCalled();
      expect(result?.name).toBe("new-name");
    });
  });

  describe("deleteTag", () => {
    test("should return true when tag is successfully soft-deleted", async () => {
      dbMocks.returning.mockImplementation(() => [{ id: "t1" }]);
      const result = await service.deleteTag({ id: "t1", userId: "u1" });
      expect(result).toBeTrue();
    });

    test("should return false if tag to delete is not found", async () => {
      dbMocks.returning.mockImplementation(() => []);
      const result = await service.deleteTag({ id: "t1", userId: "u1" });
      expect(result).toBeFalse();
    });
  });

  describe("getTagsOfUser", () => {
    test("should fetch a page of tags", async () => {
      // getTagsOfUser performs multiple queries. 
      // 1. Fetch IDs for the chunk
      // 2. Fetch full data for those IDs
      
      const mockIds = [{ id: "tag-1" }, { id: "tag-2" }];
      const mockFullData = [
        { id: "tag-1", name: "T1", userId: "u1", createdAt: new Date() },
        { id: "tag-2", name: "T2", userId: "u1", createdAt: new Date() }
      ];

      // Sequential mock returns: first call returns IDs, second returns full data
      dbMocks.limit.mockImplementation(() => mockIds);
      dbMocks.returning.mockImplementation(() => mockFullData);

      const result = await service.getTagsOfUser({ userId: "u1", limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.id).toBe("tag-1");
      expect(result.metadata.chunkTotalItems).toBe(2);
    });

    test("should throw error for invalid offset", async () => {
      expect(service.getTagsOfUser({ userId: "u1", offset: -1 }))
        .rejects.toThrow("Offset cannot be negative.");
    });
  });
});
