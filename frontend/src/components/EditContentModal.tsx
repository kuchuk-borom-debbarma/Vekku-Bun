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
import api from "@/lib/api";

interface EditContentModalProps {
  content: {
    id: string;
    title: string;
    body: string; // Updated from 'content' to 'body' based on your schema usually
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(initialContent.title);
      setBody(initialContent.body);
      setContentType(initialContent.contentType);
    }
  }, [open, initialContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.patch(`/content/${initialContent.id}`, { title, content: body, contentType }); // API expects 'content' for body
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
      <DialogContent className="max-w-2xl">
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
              <option value="JSON">JSON</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-body" className="text-sm font-medium text-zinc-900">
              Body
            </label>
            <textarea
              id="edit-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm min-h-[200px] font-mono"
              required
            />
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
