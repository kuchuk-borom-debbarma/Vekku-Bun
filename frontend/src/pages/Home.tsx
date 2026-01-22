import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FileText, Tag, Plus, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import api from "@/lib/api";

interface Content {
  id: string;
  title: string;
  contentType: string;
  createdAt: string;
  updatedAt: string;
}

const Home: React.FC = () => {
  useAuth();
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  
  const [contents, setContents] = useState<Content[]>([]);
  const [contentCount, setContentCount] = useState(0);
  const [tagCount, setTagCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Parallel fetching
        const [contentRes, tagRes] = await Promise.all([
          api.get("/content?limit=5"), // Get recent 5
          api.get("/tag?limit=1"),     // Get 1 just to see total count (if API supports total)
        ]);
        
        // Note: Assuming API response structure. 
        // If API returns { data: [], total: number }, use that.
        // Current API seems to return { items: [], nextChunkId: ... } or similar array structure based on previous context.
        // Let's assume standard response based on common patterns or just array length for now if pagination isn't full.
        // Actually, looking at the code, it returns the result object from service.
        // Usually pagination returns { items: [...], total: ... } or similar.
        // If not, we might only have count of fetched items.
        // For accurate counts, we'd need a stats endpoint or a total field.
        // For now, I'll use the length of what I got or a total field if available.
        
        const contentData = contentRes.data;
        const tagData = tagRes.data;

        setContents(contentData.data || []);
        setContentCount(contentData.metadata?.chunkTotalItems || contentData.data?.length || 0);
        setTagCount(tagData.metadata?.chunkTotalItems || tagData.data?.length || 0);
        
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const stats = [
    { label: "Total Contents", value: isLoading ? "-" : contentCount, icon: FileText },
    { label: "Total Tags", value: isLoading ? "-" : tagCount, icon: Tag },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="text-zinc-500 mt-1">{date}</p>
        </div>
        <div className="flex gap-3">
          <Link to="/tags" className="flex items-center gap-2 bg-white border border-zinc-200 text-zinc-900 px-4 py-2 rounded-lg hover:bg-zinc-50 transition-colors text-sm font-medium">
            <Plus size={16} />
            New Tag
          </Link>
          <Link to="/contents" className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-sm font-medium">
            <Plus size={16} />
            New Content
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-900">
                <stat.icon size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-zinc-900">{stat.value}</p>
            <p className="text-sm text-zinc-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">Recent Content</h3>
          <Link to="/contents" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
            View all <ArrowUpRight size={14} />
          </Link>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center text-zinc-400">Loading contents...</div>
        ) : contents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-3 text-zinc-400">
              <FileText size={20} />
            </div>
            <h3 className="text-zinc-900 font-medium mb-1">No content yet</h3>
            <p className="text-zinc-500 text-sm mb-4">Create your first content to get started.</p>
            <Link to="/contents" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
              Create Content
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
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
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-zinc-100 text-zinc-600 rounded text-xs font-medium uppercase">
                    {content.contentType}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
