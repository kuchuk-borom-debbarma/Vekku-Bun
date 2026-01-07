export type AnchorSegmentPaginationData<T> = {
  data: T[] | undefined;
  metadata: {
    //Server generated pagination metadata
    currentAnchorId: string | null;
    nextAnchorId: string | null; //null if there is no next segment
    prevAnchorId: string | null; //null if there is no previous segment (start of list)
    segmentSize: number; //size of the segment requested
    segmentItemCount: number; //number of items in the current segment. Max is segmentSize
    hasNextSegment: boolean;
    //Echoed request parameters
    requestedLimit: number;
    requestedOffset: number;
    requestedDirection: PaginationDirection;
  };
};

export enum PaginationDirection {
  NEXT = "NEXT",
  PREVIOUS = "PREVIOUS",
}
