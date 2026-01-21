import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import api from "@/lib/api";

interface CreateTagModalProps {
  onTagCreated: () => void;
  trigger?: React.ReactNode;
}

const CreateTagModal: React.FC<CreateTagModalProps> = ({ onTagCreated, trigger }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [semantic, setSemantic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.post("/tag", { name, semantic });
      setOpen(false);
      setName("");
      setSemantic("");
      onTagCreated();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to create tag");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-sm font-medium">
            <Plus size={16} />
            New Tag
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Tag</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-zinc-900">
              Tag Name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Alpha"
              className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="semantic" className="text-sm font-medium text-zinc-900">
              Semantic Meaning (Optional)
            </label>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              This is the actual meaning of what the tag is meant to be. This helps the system generate accurate embeddings for better organization and suggestions.
            </p>
            <textarea
              id="semantic"
              value={semantic}
              onChange={(e) => setSemantic(e.target.value)}
              placeholder="e.g. Technology"
              className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm min-h-[80px]"
            />
            <p className="text-[11px] text-zinc-400 italic">
              Note: System learning (embedding generation) may take some time under heavy load.
            </p>
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
              {isLoading ? "Creating..." : "Create Tag"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTagModal;
