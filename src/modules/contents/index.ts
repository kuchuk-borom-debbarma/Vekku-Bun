import { getDb } from "../../db";
import type { IContentService } from "./ContentService";
import { ContentServiceImpl } from "./ContentServiceImpl";
import type { IContentTagService } from "./ContentTagService";
import { ContentTagServiceImpl } from "./ContentTagServiceImpl";

export const getContentService = (): IContentService => {
  return new ContentServiceImpl(getDb());
};

export const getContentTagService = (): IContentTagService => {
  return new ContentTagServiceImpl();
};
