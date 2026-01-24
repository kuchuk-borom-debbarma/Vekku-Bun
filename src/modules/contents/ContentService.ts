import type { ChunkPaginationData } from "../../lib/pagination";

export type Content = {
  id: string;
  title: string;
  body: string;
  userId: string;
  contentType: ContentType;
  metadata: any;
  createdAt: Date;
  updatedAt: Date | null;
};

export enum ContentType {
  PLAIN_TEXT = "PLAIN_TEXT",
  MARKDOWN = "MARKDOWN",
  YOUTUBE_VIDEO = "YOUTUBE_VIDEO",
}

export interface IContentService {
  createYoutubeContent(data: {
    url: string;
    userId: string;
    userTitle?: string;
    userDescription?: string;
    transcript?: string;
    tagIds?: string[];
  }): Promise<Content | null>;

  createTextContent(
    data: {
      title: string;
      content: string;
      contentType: ContentType;
      userId: string;
    },
    ctx?: { waitUntil: (promise: Promise<any>) => void },
  ): Promise<Content | null>;

  updateContent(
    data: {
      id: string;
      userId: string;
      title?: string;
      content?: string;
      contentType?: ContentType;
    },
    ctx?: { waitUntil: (promise: Promise<any>) => void },
  ): Promise<Content | null>;

  deleteContent(id: string, userId: string): Promise<boolean>;

  getContentById(id: string): Promise<Content | null>;

  getContentsByUserId(
    userId: string,
    limit?: number,
    offset?: number,
    chunkId?: string,
  ): Promise<ChunkPaginationData<Content>>;

  getContentsByTags(
    userId: string,
    tagIds: string[],
    limit?: number,
    offset?: number,
  ): Promise<ChunkPaginationData<Content>>;
}