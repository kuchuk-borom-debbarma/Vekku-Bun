import { describe, expect, test, mock, beforeEach } from "bun:test";
import * as tagService from "./tags.service";

// --- Mocks ---
const mockUuid = "mock-uuid-123";
mock.module("../../lib/uuid", () => ({
  generateUUID: () => mockUuid,
}));

// Helper to create a Drizzle-like chainable mock
const createMockQuery = (data: any) => {
  const query = Promise.resolve(data) as any;
  query.where = mock(() => query);
  query.limit = mock(() => query);
  query.orderBy = mock(() => query);
  query.from = mock(() => query);
  query.values = mock(() => query);
  query.onConflictDoUpdate = mock(() => query);
  query.returning = mock(() => query);
  query.set = mock(() => query);
  return query;
};

describe("TagService", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      insert: mock(() => createMockQuery([])),
      select: mock(() => createMockQuery([])),
      update: mock(() => createMockQuery([])),
      delete: mock(() => createMockQuery([])),
    };
  });

  describe("createTag", () => {
    test("should create and return a tag", async () => {
      const input = { name: "work", semantic: "office tasks", userId: "u1" };
      const dbResponse = { ...input, id: mockUuid, createdAt: new Date(), updatedAt: new Date() };
      
      mockDb.insert.mockImplementationOnce(() => createMockQuery([dbResponse]));

      const result = await tagService.createTag(mockDb, input);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result?.id).toBe(mockUuid);
      expect(result?.name).toBe("work");
    });

    test("should return null if insertion fails", async () => {
      mockDb.insert.mockImplementationOnce(() => createMockQuery([]));
      const result = await tagService.createTag(mockDb, { name: "x", semantic: "y", userId: "z" });
      expect(result).toBeNull();
    });
  });

  describe("updateTag", () => {
    test("should update existing tag fields", async () => {
      const dbResponse = { id: "t1", name: "new-name", userId: "u1", updatedAt: new Date() };
      mockDb.update.mockImplementationOnce(() => createMockQuery([dbResponse]));

      const result = await tagService.updateTag(mockDb, { id: "t1", userId: "u1", name: "new-name" });

      expect(mockDb.update).toHaveBeenCalled();
      expect(result?.name).toBe("new-name");
    });
  });

  describe("deleteTag", () => {
    test("should return true when tag is successfully soft-deleted", async () => {
      mockDb.update.mockImplementationOnce(() => createMockQuery([{ id: "t1" }]));
      const result = await tagService.deleteTag(mockDb, { id: "t1", userId: "u1" });
      expect(result).toBeTrue();
    });

    test("should return false if tag to delete is not found", async () => {
      mockDb.update.mockImplementationOnce(() => createMockQuery([]));
      const result = await tagService.deleteTag(mockDb, { id: "t1", userId: "u1" });
      expect(result).toBeFalse();
    });
  });

  describe("getTagsOfUser", () => {
    test("should fetch a page of tags", async () => {
      const mockIds = [{ id: "tag-1" }, { id: "tag-2" }];
      const mockFullData = [
        { id: "tag-1", name: "T1", userId: "u1", createdAt: new Date(), semantic: "S1" },
        { id: "tag-2", name: "T2", userId: "u1", createdAt: new Date(), semantic: "S2" }
      ];

      mockDb.select
        .mockImplementationOnce(() => createMockQuery(mockIds))
        .mockImplementationOnce(() => createMockQuery(mockFullData));

      const result = await tagService.getTagsOfUser(mockDb, { userId: "u1", limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.id).toBe("tag-1");
      expect(result.metadata.chunkTotalItems).toBe(2);
    });

    test("should throw error for invalid offset", async () => {
      expect(tagService.getTagsOfUser(mockDb, { userId: "u1", offset: -1 }))
        .rejects.toThrow("Offset cannot be negative.");
    });
  });
});
