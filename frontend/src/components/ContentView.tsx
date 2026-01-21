import React, { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tag, Sparkles, Plus, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "@/lib/api";

interface ContentViewProps {
  content: {
    id: string;
    title: string;
    body: string;
    contentType: string;
    createdAt: string;
  };
  trigger?: React.ReactNode;
}

interface TagItem {
  id: string;
  name: string;
  score?: string; // For suggestions
}

const ContentView: React.FC<ContentViewProps> = ({ content, trigger }) => {
  const [activeTags, setActiveTags] = useState<TagItem[]>([]);
  const [suggestions, setSuggestions] = useState<TagItem[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  const fetchTagsAndSuggestions = async () => {
    setIsLoadingTags(true);
    try {
      const [tagsRes, suggestionsRes] = await Promise.all([
        api.get(`/content/${content.id}/tags`),
        api.get(`/suggestions/content/${content.id}`),
      ]);
      // Active tags are paginated: { data: [], metadata: {} }
      setActiveTags(tagsRes.data.data || []);
      // Suggestions are a raw array
      setSuggestions(suggestionsRes.data || []);
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    } finally {
      setIsLoadingTags(false);
    }
  };

  useEffect(() => {
    fetchTagsAndSuggestions();
  }, [content.id]);

  const addTag = async (tagId: string) => {
    try {
      await api.post(`/content/${content.id}/tags`, { tagIds: [tagId] });
      // Move from suggestions to active
      const tagToAdd = suggestions.find((t) => t.id === tagId);
      if (tagToAdd) {
        setActiveTags([...activeTags, tagToAdd]);
        setSuggestions(suggestions.filter((t) => t.id !== tagId));
      }
    } catch (error) {
      console.error("Failed to add tag:", error);
    }
  };

  const removeTag = async (tagId: string) => {
    try {
      await api.delete(`/content/${content.id}/tags`, { data: { tagIds: [tagId] } });
      setActiveTags(activeTags.filter((t) => t.id !== tagId));
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <button className="text-zinc-900 hover:text-indigo-600 font-medium transition-colors text-left">
            {content.title}
          </button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-2xl md:max-w-3xl">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-bold">{content.title}</SheetTitle>
          <div className="flex flex-col gap-1">
            <div className="text-sm text-zinc-500">
              Created on {new Date(content.createdAt).toLocaleDateString()} • {content.contentType}
            </div>
            <div className="text-[10px] font-mono text-zinc-400 select-all">
              ID: {content.id}
            </div>
          </div>
        </SheetHeader>

        {/* Content Body */}
        <div className="mb-8">
          {content.contentType === "MARKDOWN" ? (
            <div className="prose prose-zinc max-w-none prose-sm sm:prose-base">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content.body}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-zinc-800 text-sm leading-relaxed font-sans">
              {content.body}
            </div>
          )}
        </div>

        <div className="border-t border-zinc-100 pt-6">
          <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <Tag size={18} />
            Active Tags
          </h3>
          
          <div className="flex flex-wrap gap-2 mb-8">
            {activeTags.length === 0 ? (
              <span className="text-sm text-zinc-400 italic">No tags attached yet.</span>
            ) : (
              activeTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-700 text-sm font-medium border border-zinc-200"
                >
                  {tag.name}
                  <button
                    onClick={() => removeTag(tag.id)}
                    className="p-0.5 hover:bg-zinc-200 rounded-full transition-colors text-zinc-400 hover:text-zinc-600"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))
            )}
          </div>

          <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-500" />
            Suggested Tags
          </h3>
          
          <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
            <div className="flex flex-wrap gap-2">
              {isLoadingTags ? (
                <span className="text-sm text-zinc-400">Loading suggestions...</span>
              ) : suggestions.length === 0 ? (
                <span className="text-sm text-zinc-400 italic">
                  No suggestions available. Try adding more context to your content.
                </span>
              ) : (
                suggestions
                  // Filter out tags that are already active
                  .filter((s) => !activeTags.some((active) => active.id === s.id))
                  .slice(0, 8) // Limit display
                  .map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => addTag(tag.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-indigo-700 text-sm font-medium border border-indigo-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                    >
                      {tag.name}
                      <Plus size={12} />
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ContentView;
