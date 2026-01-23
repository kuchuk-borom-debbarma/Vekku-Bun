import { getDb } from "../../db";
import type { IContentService } from "./ContentService";
import { ContentServiceImpl } from "./ContentServiceImpl";
import type { IContentTagService } from "./ContentTagService";
import { ContentTagServiceImpl } from "./ContentTagServiceImpl";
import { getTagService } from "../tags";
import { getContentTagSuggestionService } from "../suggestions";

export const getContentService = (): IContentService => {
  return new ContentServiceImpl(getDb());
};

export const getContentTagService = (): IContentTagService => {
  return new ContentTagServiceImpl(
    getTagService(),
    getContentTagSuggestionService()
  );
};
