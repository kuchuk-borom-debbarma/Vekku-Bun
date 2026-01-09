import { getDb } from "../../db";
import type { IContentService } from "./ContentService";
import { ContentServiceImpl } from "./ContentServiceImpl";

export const getContentService = (): IContentService => {
  return new ContentServiceImpl(getDb());
};