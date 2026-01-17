import { describe, expect, test, mock, beforeEach } from "bun:test";
import { TagServiceImpl } from "./TagServiceImpl";

// --- Mocks ---
const mockUuid = "mock-uuid-123";
const mockNormalize = (s: string) => s.toLowerCase().trim();

mock.module("../../lib/uuid", () => ({
  generateUUID: () => mockUuid,
  normalize: mockNormalize,
}));

// Mock Database
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
  // query.leftJoin = mock(() => query); // Removed as we don't use it anymore
  return query;
};

const mockDb = {
  insert: mock(() => createMockQuery([])),
  select: mock(() => createMockQuery([])),
  update: mock(() => createMockQuery([])),
  delete: mock(() => createMockQuery([])),
};

mock.module("../../db", () => ({
  getDb: () => mockDb,
}));

// Mock Suggestion Service
const mockSuggestionService = {
  learnTag: mock(async () => "mock-embedding-id"),
  ensureConceptExists: mock(async () => "mock-embedding-id"),
};

mock.module("../suggestions", () => ({
  getTagSuggestionService: () => mockSuggestionService,
}));

describe("TagService", () => {
  let tagService: TagServiceImpl;

  beforeEach(() => {
    tagService = new TagServiceImpl();
    // Reset mocks
    mockDb.insert.mockClear();
    mockDb.select.mockClear();
    mockDb.update.mockClear();
    mockDb.delete.mockClear();
    mockSuggestionService.learnTag.mockClear();
    mockSuggestionService.ensureConceptExists.mockClear();
  });

  describe("createTag", () => {
    test("should create and return a tag without synchronous learning", async () => {
      const input = { name: "work", semantic: "Office Tasks", userId: "u1" };
      const dbResponse = {
        id: mockUuid,
        name: "work",
        userId: "u1",
        semantic: "office tasks", // Normalized
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock insert returning the tag
      mockDb.insert.mockImplementationOnce(() => createMockQuery([dbResponse]));

      const result = await tagService.createTag(input);

      // Verify explicit learning is NOT called
      expect(mockSuggestionService.ensureConceptExists).not.toHaveBeenCalled();
      
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result?.id).toBe(mockUuid);
      expect(result?.name).toBe("work");
      expect(result?.semantic).toBe("office tasks");
    });

    test("should return null if insertion fails", async () => {
      mockDb.insert.mockImplementationOnce(() => createMockQuery([]));
      const result = await tagService.createTag({
        name: "x",
        semantic: "y",
        userId: "z",
      });
      expect(result).toBeNull();
    });
  });

  describe("updateTag", () => {
    test("should update existing tag fields", async () => {
      const dbResponse = {
        id: "t1",
        name: "new-name",
        userId: "u1",
        semantic: "old-semantic",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.update.mockImplementationOnce(() => createMockQuery([dbResponse]));

      const result = await tagService.updateTag({
        id: "t1",
        userId: "u1",
        name: "new-name",
      });

      expect(mockDb.update).toHaveBeenCalled();
      expect(result?.name).toBe("new-name");
      expect(result?.semantic).toBe("old-semantic");
    });

    test("should update semantic without synchronous learning", async () => {
       const dbResponse = {
        id: "t1",
        name: "work",
        userId: "u1",
        semantic: "new-semantic",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.update.mockImplementationOnce(() => createMockQuery([dbResponse]));

      const result = await tagService.updateTag({
        id: "t1",
        userId: "u1",
        semantic: "New-Semantic",
      });

      expect(mockSuggestionService.ensureConceptExists).not.toHaveBeenCalled();
      expect(result?.semantic).toBe("new-semantic"); // Normalized from DB response
    });
  });

  describe("deleteTag", () => {
    test("should return true when tag is successfully hard-deleted", async () => {
      mockDb.delete.mockImplementationOnce(() =>
        createMockQuery([{ id: "t1" }]),
      );
      const result = await tagService.deleteTag({ id: "t1", userId: "u1" });
      expect(result).toBeTrue();
    });

    test("should return false if tag to delete is not found", async () => {
      mockDb.delete.mockImplementationOnce(() => createMockQuery([]));
      const result = await tagService.deleteTag({ id: "t1", userId: "u1" });
      expect(result).toBeFalse();
    });
  });

  describe("getTagsOfUser", () => {
    test("should fetch a page of tags", async () => {
      const mockIds = [{ id: "tag-1" }, { id: "tag-2" }];
      // Mock Data structure (Flat now)
      const mockFullData = [
        {
          id: "tag-1",
          name: "T1",
          userId: "u1",
          semantic: "S1",
          createdAt: new Date(),
          updatedAt: null,
        },
        {
          id: "tag-2",
          name: "T2",
          userId: "u1",
          semantic: "S2",
          createdAt: new Date(),
          updatedAt: null,
        },
      ];

      mockDb.select
        .mockImplementationOnce(() => createMockQuery(mockIds)) // chunk query
        .mockImplementationOnce(() => createMockQuery(mockFullData)); // data query

      const result = await tagService.getTagsOfUser({
        userId: "u1",
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.id).toBe("tag-1");
      expect(result.data[0]?.semantic).toBe("S1");
      expect(result.metadata.chunkTotalItems).toBe(2);
    });

    test("should throw error for invalid offset", async () => {
      expect(
        tagService.getTagsOfUser({ userId: "u1", offset: -1 }),
      ).rejects.toThrow("Offset cannot be negative.");
    });
  });
});
