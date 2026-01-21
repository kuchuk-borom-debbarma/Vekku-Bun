import React, { useEffect, useState } from "react";
import { Plus, Search, FileText, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import api from "@/lib/api";
import CreateContentModal from "@/components/CreateContentModal";
import EditContentModal from "@/components/EditContentModal";

interface Content {
  id: string;
  title: string;
  body: string;
  contentType: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMetadata {
  nextChunkId: string | null;
  chunkSize: number;
  chunkTotalItems: number;
  limit: number;
  offset: number;
}

const LIMIT = 5;

const Contents: React.FC = () => {
  const [contents, setContents] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination State
  const [offset, setOffset] = useState(0);
  const [chunkId, setChunkId] = useState<string | undefined>(undefined);
  const [chunkStack, setChunkStack] = useState<string[]>([]); // To go back to previous chunks
  const [metadata, setMetadata] = useState<PaginationMetadata | null>(null);

  const fetchContents = async (currentOffset: number, currentChunkId?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: LIMIT.toString(),
        offset: currentOffset.toString(),
      });
      if (currentChunkId) params.append("chunkId", currentChunkId);

      const response = await api.get(`/content?${params.toString()}`);
      setContents(response.data.data || []);
      setMetadata(response.data.metadata);
    } catch (error) {
      console.error("Failed to fetch contents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContents(offset, chunkId);
  }, [offset, chunkId]);

  const handleRefresh = () => {
    fetchContents(offset, chunkId);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this content?")) return;
    try {
      await api.delete(`/content/${id}`);
      handleRefresh();
    } catch (error) {
      console.error("Failed to delete content:", error);
      alert("Failed to delete content");
    }
  };

  const handleNext = () => {
    if (!metadata) return;

    if (offset + LIMIT < metadata.chunkTotalItems) {
      setOffset(offset + LIMIT);
    } else if (metadata.nextChunkId) {
      setChunkStack([...chunkStack, chunkId || ""]); 
      setChunkId(metadata.nextChunkId);
      setOffset(0);
    }
  };

  const handlePrev = () => {
    if (offset - LIMIT >= 0) {
      setOffset(offset - LIMIT);
    } else if (chunkStack.length > 0) {
      const prevStack = [...chunkStack];
      const prevChunk = prevStack.pop();
      setChunkStack(prevStack);
      setChunkId(prevChunk === "" ? undefined : prevChunk);
      setOffset(0);
    }
  };

  const canGoNext = metadata ? (offset + LIMIT < metadata.chunkTotalItems || !!metadata.nextChunkId) : false;
  const canGoPrev = offset > 0 || chunkStack.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Contents</h1>
        <CreateContentModal onContentCreated={handleRefresh} />
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4 bg-white p-2 rounded-lg border border-zinc-200 shadow-sm">
        <div className="flex-1 flex items-center gap-2 px-2">
          <Search size={18} className="text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search contents..." 
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-900 placeholder-zinc-400"
          />
        </div>
      </div>

      {/* Content List Container */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm min-h-[400px] overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-8 text-zinc-500">
            Loading contents...
          </div>
        ) : contents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mb-3">
              <FileText className="text-zinc-300" />
            </div>
            <p className="font-medium text-zinc-900">No contents found.</p>
            <div className="mt-4">
              <CreateContentModal 
                onContentCreated={handleRefresh}
                trigger={
                  <button className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                    Create your first content
                  </button>
                }
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 divide-y divide-zinc-50">
            {contents.map((content) => (
              <div key={content.id} className="px-6 py-4 flex items-center justify-between hover:bg-zinc-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <FileText size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 group-hover:text-indigo-600 transition-colors">
                      {content.title || "Untitled Content"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Edited {new Date(content.updatedAt || content.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-2 py-1 bg-zinc-100 text-zinc-600 rounded text-xs font-medium uppercase">
                    {content.contentType}
                  </span>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <EditContentModal content={content} onContentUpdated={handleRefresh} />
                     <button 
                        onClick={() => handleDelete(content.id)}
                        className="text-zinc-400 hover:text-red-600 transition-colors p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Footer */}
        {contents.length > 0 && (
           <div className="border-t border-zinc-100 px-6 py-3 flex items-center justify-between bg-zinc-50/50">
             <span className="text-xs text-zinc-500">
                Showing {offset + 1}-{Math.min(offset + LIMIT, metadata?.chunkTotalItems || 0)} of {metadata?.chunkTotalItems || 0} in this segment
             </span>
             <div className="flex items-center gap-2">
               <button
                 onClick={handlePrev}
                 disabled={!canGoPrev || isLoading}
                 className="p-1.5 rounded-md hover:bg-white hover:shadow-sm border border-transparent hover:border-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-all text-zinc-600"
               >
                 <ChevronLeft size={16} />
               </button>
               <button
                 onClick={handleNext}
                 disabled={!canGoNext || isLoading}
                 className="p-1.5 rounded-md hover:bg-white hover:shadow-sm border border-transparent hover:border-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-all text-zinc-600"
               >
                 <ChevronRight size={16} />
               </button>
             </div>
           </div>
         )}
      </div>
    </div>
  );
};

export default Contents;
