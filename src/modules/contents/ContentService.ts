import type { ChunkPaginationData } from "../../lib/pagination";

export type Content = {
  id: string;
  title: string;
  body: string;
  userId: string;
  contentType: ContentType;
  createdAt: Date;
  updatedAt: Date | null;
};

export enum ContentType {
  PLAIN_TEXT = "PLAIN_TEXT",
  MARKDOWN = "MARKDOWN",
}

export interface IContentService {
  createContent(data: {
    title: string;
    content: string;
    contentType: ContentType;
    userId: string;
  }): Promise<Content | null>;

  updateContent(data: {
    id: string;
    userId: string;
    title?: string;
    content?: string;
    contentType?: ContentType;
  }): Promise<Content | null>;

  deleteContent(id: string, userId: string): Promise<boolean>;

  getContentById(id: string): Promise<Content | null>;

  getContentsByUserId(
    userId: string,
    limit?: number,
    offset?: number,
    chunkId?: string,
  ): Promise<ChunkPaginationData<Content>>;
}