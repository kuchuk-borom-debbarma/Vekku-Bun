import { getDb } from "../../db";
import type { ITagService } from "./TagService";
import { TagServiceImpl } from "./TagServiceImpl";

export const getTagService = (): ITagService => {
  return new TagServiceImpl(getDb());
};
