import { getDb } from "../../db";
import type { IContentService } from "./ContentService";
import { ContentServiceImpl } from "./ContentServiceImpl";
import type { IContentTagService } from "./ContentTagService";
import { ContentTagServiceImpl } from "./ContentTagServiceImpl";
import { getTagService } from "../tags";
import { getContentTagSuggestionService } from "../suggestions";
import type { IContentEmbeddingService } from "./ContentEmbeddingService";
import { ContentEmbeddingServiceImpl } from "./ContentEmbeddingServiceImpl";

export const getContentService = (): IContentService => {
  return new ContentServiceImpl(getDb());
};

export const getContentEmbeddingService = (): IContentEmbeddingService => {
  return new ContentEmbeddingServiceImpl();
};

export const getContentTagService = (): IContentTagService => {
  return new ContentTagServiceImpl(
    getTagService(),
    getContentTagSuggestionService()
  );
};
