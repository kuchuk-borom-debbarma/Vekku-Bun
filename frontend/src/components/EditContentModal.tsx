import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "@/lib/api";

interface EditContentModalProps {
  content: {
    id: string;
    title: string;
    body: string;
    contentType: string;
  };
  onContentUpdated: () => void;
  trigger?: React.ReactNode;
}

const EditContentModal: React.FC<EditContentModalProps> = ({ content: initialContent, onContentUpdated, trigger }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialContent.title);
  const [body, setBody] = useState(initialContent.body);
  const [contentType, setContentType] = useState(initialContent.contentType);
  const [view, setView] = useState<"write" | "preview">("write");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(initialContent.title);
      setBody(initialContent.body);
      setContentType(initialContent.contentType);
      setView("write");
    }
  }, [open, initialContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.patch(`/content/${initialContent.id}`, { title, content: body, contentType }); 
      setOpen(false);
      onContentUpdated();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to update content");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="text-zinc-400 hover:text-indigo-600 transition-colors p-1">
            <Edit2 size={16} />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Content</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="edit-title" className="text-sm font-medium text-zinc-900">
              Title
            </label>
            <input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-content-type" className="text-sm font-medium text-zinc-900">
              Type
            </label>
            <select
              id="edit-content-type"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm bg-white"
            >
              <option value="PLAIN_TEXT">Plain Text</option>
              <option value="MARKDOWN">Markdown</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="edit-body" className="text-sm font-medium text-zinc-900">
                Body
              </label>
              {contentType === "MARKDOWN" && (
                <div className="flex bg-zinc-100 rounded-md p-1">
                  <button
                    type="button"
                    onClick={() => setView("write")}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${
                      view === "write" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("preview")}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${
                      view === "preview" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    Preview
                  </button>
                </div>
              )}
            </div>

            {contentType === "MARKDOWN" && view === "preview" ? (
              <div className="w-full px-4 py-3 border border-zinc-200 rounded-md bg-zinc-50 min-h-[300px] prose prose-sm max-w-none overflow-y-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {body || "*Nothing to preview*"}
                </ReactMarkdown>
              </div>
            ) : (
              <textarea
                id="edit-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm min-h-[300px] font-mono"
                required
              />
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-black rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditContentModal;
