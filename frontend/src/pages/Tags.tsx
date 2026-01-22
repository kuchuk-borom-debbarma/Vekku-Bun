import React, { useEffect, useState } from "react";
import { Search, Tag as TagIcon, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import CreateTagModal from "@/components/CreateTagModal";
import EditTagModal from "@/components/EditTagModal";

interface Tag {
  id: string;
  name: string;
  semantic?: string;
  createdAt: string;
}

interface PaginationMetadata {
  nextChunkId: string | null;
  chunkSize: number;
  chunkTotalItems: number;
  limit: number;
  offset: number;
}

const LIMIT = 5;

const Tags: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Pagination State
  const [offset, setOffset] = useState(0);
  const [chunkId, setChunkId] = useState<string | undefined>(undefined);
  const [chunkStack, setChunkStack] = useState<string[]>([]); // To go back to previous chunks
  const [metadata, setMetadata] = useState<PaginationMetadata | null>(null);

  const fetchTags = async (currentOffset: number, currentChunkId?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: LIMIT.toString(),
        offset: currentOffset.toString(),
      });
      if (currentChunkId) params.append("chunkId", currentChunkId);

      const response = await api.get(`/tag?${params.toString()}`);
      setTags(response.data.data || []); 
      setMetadata(response.data.metadata);
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTags(offset, chunkId);
  }, [offset, chunkId]);

  const handleRefresh = () => {
    fetchTags(offset, chunkId);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tag? This action cannot be undone.")) return;
    
    try {
      await api.delete(`/tag/${id}`);
      handleRefresh();
    } catch (error) {
      console.error("Failed to delete tag:", error);
      alert("Failed to delete tag");
    }
  };

  const handleNext = () => {
    if (!metadata) return;

    // Check if we can just increase offset within current chunk
    if (offset + LIMIT < metadata.chunkTotalItems) {
      setOffset(offset + LIMIT);
    } 
    // Otherwise check if there is a next chunk
    else if (metadata.nextChunkId) {
      setChunkStack([...chunkStack, chunkId || ""]); // Push current chunk (empty string if initial)
      setChunkId(metadata.nextChunkId);
      setOffset(0);
    }
  };

  const handlePrev = () => {
    // Check if we can decrease offset within current chunk
    if (offset - LIMIT >= 0) {
      setOffset(offset - LIMIT);
    }
    // Otherwise go back to previous chunk if available
    else if (chunkStack.length > 0) {
      const prevStack = [...chunkStack];
      const prevChunk = prevStack.pop();
      setChunkStack(prevStack);
      
      // When going back to a previous chunk, we reset to offset 0 (simplification)
      // Ideally we would go to the end, but that requires knowing the previous chunk's size
      setChunkId(prevChunk === "" ? undefined : prevChunk);
      setOffset(0);
    }
  };

  const canGoNext = metadata ? (offset + LIMIT < metadata.chunkTotalItems || !!metadata.nextChunkId) : false;
  const canGoPrev = offset > 0 || chunkStack.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Tags</h1>
        <CreateTagModal onTagCreated={handleRefresh} />
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4 bg-white p-2 rounded-lg border border-zinc-200 shadow-sm">
        <div className="flex-1 flex items-center gap-2 px-2">
          <Search size={18} className="text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search tags..." 
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-900 placeholder-zinc-400"
          />
        </div>
      </div>

      {/* Tags Grid Container */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
         {isLoading ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-zinc-400">Loading tags...</div>
         ) : tags.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mb-3">
                  <TagIcon className="text-zinc-300" />
                </div>
                <p className="font-medium text-zinc-900">No tags found.</p>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs text-center">Tags allow you to organize your content semantically. Create one to get started.</p>
                <div className="mt-4">
                  <CreateTagModal 
                    onTagCreated={handleRefresh} 
                    trigger={
                      <button className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                        Create Tag
                      </button>
                    }
                  />
                </div>
            </div>
         ) : (
           <div className="flex-1 divide-y divide-zinc-50">
             {tags.map((tag) => (
               <div key={tag.id} className="px-6 py-4 flex items-center justify-between hover:bg-zinc-50 transition-colors group">
                 <div>
                   <h3 className="text-sm font-medium text-zinc-900">{tag.name}</h3>
                   {tag.semantic && (
                     <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{tag.semantic}</p>
                   )}
                 </div>
                 <div className="flex items-center gap-4">
                   <span className="text-xs text-zinc-400 hidden sm:block">
                     {new Date(tag.createdAt).toLocaleDateString()}
                   </span>
                   <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <EditTagModal tag={tag} onTagUpdated={handleRefresh} />
                     <button 
                        onClick={() => handleDelete(tag.id)}
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
         {tags.length > 0 && (
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

export default Tags;
