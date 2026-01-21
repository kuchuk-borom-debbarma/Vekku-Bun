import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit2 } from "lucide-react";
import api from "@/lib/api";

interface EditTagModalProps {
  tag: {
    id: string;
    name: string;
    semantic?: string;
  };
  onTagUpdated: () => void;
  trigger?: React.ReactNode;
}

const EditTagModal: React.FC<EditTagModalProps> = ({ tag, onTagUpdated, trigger }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tag.name);
  const [semantic, setSemantic] = useState(tag.semantic || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(tag.name);
      setSemantic(tag.semantic || "");
    }
  }, [open, tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.patch(`/tag/${tag.id}`, { name, semantic });
      setOpen(false);
      onTagUpdated();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to update tag");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Tag</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="edit-name" className="text-sm font-medium text-zinc-900">
              Tag Name
            </label>
            <input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-semantic" className="text-sm font-medium text-zinc-900">
              Semantic Meaning
            </label>
             <p className="text-[11px] text-zinc-500 leading-relaxed">
              Updating this may trigger re-learning of the tag's concept.
            </p>
            <textarea
              id="edit-semantic"
              value={semantic}
              onChange={(e) => setSemantic(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm min-h-[80px]"
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

export default EditTagModal;
