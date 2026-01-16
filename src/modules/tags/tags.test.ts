import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { TagServiceImpl } from "./TagServiceImpl";

// --- Mocks ---
const mockUuid = "mock-uuid-123";
mock.module("../../lib/uuid", () => ({
  generateUUID: () => mockUuid,
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
  query.leftJoin = mock(() => query); // Added for join
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
    test("should create and return a tag", async () => {
      const input = { name: "work", semantic: "office tasks", userId: "u1" };
      const dbResponse = {
        id: mockUuid,
        name: "work",
        userId: "u1",
        embeddingId: "mock-embedding-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock insert returning the tag
      mockDb.insert.mockImplementationOnce(() => createMockQuery([dbResponse]));

      const result = await tagService.createTag(input);

      expect(mockSuggestionService.ensureConceptExists).toHaveBeenCalledWith("office tasks");
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
        embeddingId: "old-emb-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      // For semantic fetch fallback
      const mockConcept = [{ semantic: "old-semantic" }];

      mockDb.update.mockImplementationOnce(() => createMockQuery([dbResponse]));
      mockDb.select.mockImplementationOnce(() => createMockQuery(mockConcept));

      const result = await tagService.updateTag({
        id: "t1",
        userId: "u1",
        name: "new-name",
      });

      expect(mockDb.update).toHaveBeenCalled();
      expect(result?.name).toBe("new-name");
      expect(result?.semantic).toBe("old-semantic");
    });

    test("should update semantic and learn new tag", async () => {
       const dbResponse = {
        id: "t1",
        name: "work",
        userId: "u1",
        embeddingId: "new-emb-id", // Updated ID
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.update.mockImplementationOnce(() => createMockQuery([dbResponse]));
      // No select needed because we passed semantic

      const result = await tagService.updateTag({
        id: "t1",
        userId: "u1",
        semantic: "new-semantic",
      });

      expect(mockSuggestionService.ensureConceptExists).toHaveBeenCalledWith("new-semantic");
      expect(result?.semantic).toBe("new-semantic");
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
      // Mock Data structure for the Join
      const mockFullData = [
        {
          tag: {
            id: "tag-1",
            name: "T1",
            userId: "u1",
            createdAt: new Date(),
            updatedAt: null,
          },
          embedding: { semantic: "S1" },
        },
        {
          tag: {
            id: "tag-2",
            name: "T2",
            userId: "u1",
            createdAt: new Date(),
            updatedAt: null,
          },
          embedding: { semantic: "S2" },
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