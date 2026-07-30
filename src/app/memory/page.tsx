"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

interface MemoryItem {
  id: string;
  content: string;
  createdAt: string;
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function refresh() {
    const res = await fetch("/api/memories");
    const data = await res.json();
    setMemories(data.memories ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/memories")
      .then((res) => res.json())
      .then((data) => {
        setMemories(data.memories ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!newContent.trim()) return;
    setAdding(true);
    const res = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newContent.trim() }),
    });
    setAdding(false);
    if (res.ok) {
      setNewContent("");
      refresh();
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editValue.trim()) return;
    await fetch(`/api/memories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editValue.trim() }),
    });
    setEditingId(null);
    refresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/memories/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <Logo size={38} />
          <div>
            <Link href="/" className="text-xs text-muted-2 transition-colors hover:text-foreground">
              ← Back to chat
            </Link>
            <h1 className="font-display mt-0.5 text-2xl italic text-foreground">
              What AURELIA remembers
            </h1>
          </div>
        </div>

        <p className="mb-6 text-sm text-muted">
          AURELIA automatically remembers useful facts from your conversations
          so it doesn&apos;t need reminding every time. Add, edit, or remove
          anything here.
        </p>

        <div className="mb-6 flex gap-2">
          <input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add something for AURELIA to remember…"
            className="flex-1 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newContent.trim()}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Add
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-2">Loading…</p>
        ) : memories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-14 text-center">
            <p className="text-sm text-muted">Nothing remembered yet.</p>
            <p className="mt-1 text-xs text-muted-2">
              Keep chatting — AURELIA will pick up useful context automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {memories.map((m) => (
              <div
                key={m.id}
                className="group flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3"
              >
                {editingId === m.id ? (
                  <>
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(m.id)}
                      autoFocus
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      onClick={() => handleSaveEdit(m.id)}
                      className="flex-shrink-0 text-xs text-foreground hover:underline"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-shrink-0 text-xs text-muted-2 hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <p className="flex-1 text-sm leading-relaxed text-foreground">{m.content}</p>
                    <button
                      onClick={() => {
                        setEditingId(m.id);
                        setEditValue(m.content);
                      }}
                      className="flex-shrink-0 text-xs text-muted-2 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="flex-shrink-0 text-xs text-muted-2 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
