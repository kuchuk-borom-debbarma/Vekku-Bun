/**
 * Centralized topic names for the application events.
 */
export const TOPICS = {
  CONTENT: {
    CREATED: "content.created",
    UPDATED: "content.updated",
    DELETED: "content.deleted",
  },
  TAG: {
    CREATED: "tag.created",
    UPDATED: "tag.updated",
    DELETED: "tag.deleted",
  }
} as const;

export type TopicType = typeof TOPICS;
