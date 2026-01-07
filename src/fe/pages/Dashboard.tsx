import React, { useEffect, useState } from "react";
import { api, logout } from "../lib/api";

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

  // Hardcoded userId for now, in a real app this would come from the JWT payload
  // However, the backend requires userId in the body for createTag? 
  // Wait, backend API design:
  // createTag(data: { name, semantic, userId })
  // Ideally, the backend should extract userId from the JWT token in a middleware.
  // But currently, the controller does: `const data = await c.req.json(); await tagService.createTag(data);`
  // So the client must send userId.
  // I will decode the JWT to get the userId.
  
  const getUserId = () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return "";
    try {
        const parts = token.split('.');
        if (parts.length < 2) return "";
        const payload = JSON.parse(atob(parts[1]!));
        return payload.sub; // sub is usually userId
    } catch (e) {
        return "";
    }
  };

  const userId = getUserId();

  const fetchTags = async () => {
    try {
      // getTagsOfUser requires userId in query
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
        userId // Sending userId explicitly as per current backend logic
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
          // deleteTag requires userId in body
          await api.delete(`/tag/${id}`, {
              data: { userId } 
          });
          fetchTags();
      } catch (err) {
          alert("Failed to delete tag");
      }
  }

  if (!userId) {
      return <div>Loading user session...</div>;
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Dashboard</h1>
        <button onClick={logout} style={{ padding: "0.5rem", background: "red", color: "white", border: "none" }}>
            Logout
        </button>
      </div>

      <div style={{ margin: "2rem 0", padding: "1rem", border: "1px solid #ddd" }}>
        <h3>Create New Tag</h3>
        <form onSubmit={handleCreateTag} style={{ display: "flex", gap: "1rem" }}>
            <input 
                placeholder="Tag Name (e.g. work)" 
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                required
            />
            <input 
                placeholder="Semantic (e.g. Office tasks)" 
                value={newTagSemantic}
                onChange={e => setNewTagSemantic(e.target.value)}
                required
            />
            <button type="submit">Add Tag</button>
        </form>
      </div>

      <h3>Your Tags</h3>
      {loading ? (
        <p>Loading tags...</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
            {tags.map(tag => (
                <li key={tag.id} style={{ padding: "0.5rem", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
                    <span>
                        <strong>{tag.name}</strong>: {tag.semantic}
                    </span>
                    <button onClick={() => handleDeleteTag(tag.id)} style={{ color: "red", border: "none", background: "none", cursor: "pointer" }}>
                        Delete
                    </button>
                </li>
            ))}
            {tags.length === 0 && <p>No tags found.</p>}
        </ul>
      )}
    </div>
  );
};
