import type { Content } from "../../modules/contents/ContentService";

export interface ContentCreatedPayload {
  content: Content;
}

export interface ContentUpdatedPayload {
  content: Content;
  previousContent?: Partial<Content>;
}
