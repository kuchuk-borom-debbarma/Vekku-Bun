export type ChunkPaginationData<T> = {
  data: T[];
  metadata: {
    // The ID to use to fetch the next chunk of items
    nextChunkId: string | null;
    
    // The total capacity of the chunk (e.g. 2000)
    chunkSize: number;
    
    // The actual number of items found in this chunk (<= chunkSize)
    chunkTotalItems: number;

    // Echoed request parameters for calculation convenience
    limit: number;
    offset: number;
  };
};
