import React, { useEffect, useState } from "react";
import { api, logout } from "../lib/api";
import { Layout } from "../components/Layout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

type Tag = {
  id: string;
  name: string;
  semantic: string;
  userId: string;
};

export const Dashboard = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagSemantic, setNewTagSemantic] = useState("");
  const [loading, setLoading] = useState(true);

  const getUserId = () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return "";
    try {
        const parts = token.split('.');
        if (parts.length < 2) return "";
        const payload = JSON.parse(atob(parts[1]!));
        return payload.sub; 
    } catch (e) {
        return "";
    }
  };

  const userId = getUserId();

  const fetchTags = async () => {
    try {
      const { data } = await api.get(`/tag?userId=${userId}&limit=20`);
      setTags(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
        fetchTags();
    }
  }, [userId]);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName || !newTagSemantic) return;

    try {
      await api.post("/tag", {
        name: newTagName,
        semantic: newTagSemantic,
        userId 
      });
      setNewTagName("");
      setNewTagSemantic("");
      fetchTags();
    } catch (err) {
      alert("Failed to create tag");
    }
  };

  const handleDeleteTag = async (id: string) => {
      if (!confirm("Delete tag?")) return;
      try {
          await api.delete(`/tag/${id}`, {
              data: { userId } 
          });
          fetchTags();
      } catch (err) {
          alert("Failed to delete tag");
      }
  }

  if (!userId) {
      return <Layout>Loading user session...</Layout>;
  }

  return (
    <Layout>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", borderBottom: "1px solid #eee", paddingBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <Button variant="danger" onClick={logout}>
            Logout
        </Button>
      </header>

      <section style={{ marginBottom: "2rem", padding: "1.5rem", border: "1px solid #eee", borderRadius: "8px", background: "#f9f9f9" }}>
        <h3 style={{ marginTop: 0 }}>Create New Tag</h3>
        <form onSubmit={handleCreateTag} style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
                <Input 
                    placeholder="Tag Name (e.g. work)" 
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    required
                    label="Name"
                    style={{ background: "white" }}
                />
            </div>
            <div style={{ flex: 2 }}>
                <Input 
                    placeholder="Semantic (e.g. Office tasks)" 
                    value={newTagSemantic}
                    onChange={e => setNewTagSemantic(e.target.value)}
                    required
                    label="Description"
                    style={{ background: "white" }}
                />
            </div>
            <Button type="submit">Add Tag</Button>
        </form>
      </section>

      <section>
        <h3>Your Tags</h3>
        {loading ? (
            <p>Loading tags...</p>
        ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
                {tags.map(tag => (
                    <div key={tag.id} style={{ padding: "1rem", border: "1px solid #eee", borderRadius: "4px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "white" }}>
                        <div>
                            <strong style={{ fontSize: "1.1rem", display: "block" }}>{tag.name}</strong>
                            <span style={{ color: "#666" }}>{tag.semantic}</span>
                        </div>
                        <Button variant="ghost" onClick={() => handleDeleteTag(tag.id)}>
                            Delete
                        </Button>
                    </div>
                ))}
                {tags.length === 0 && <p style={{ color: "#888", fontStyle: "italic" }}>No tags found. Create one above.</p>}
            </div>
        )}
      </section>
    </Layout>
  );
};