"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "./logo";

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export function Sidebar({
  activeId,
  onSelect,
  userName,
  isAdmin,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  userName?: string | null;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    setConversations(data.conversations ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleNewChat() {
    const res = await fetch("/api/conversations", { method: "POST" });
    const data = await res.json();
    await refresh();
    onSelect(data.conversation.id);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    await refresh();
    if (activeId === id) {
      router.push("/");
    }
  }

  // Group conversations by rough recency — small structural detail that
  // actually communicates something (how stale this thread is).
  const groups = groupByRecency(conversations);

  return (
    <aside className="flex h-full w-72 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <Logo size={30} />
        <div className="leading-none">
          <div className="font-display text-lg tracking-brand text-foreground">
            AURELIA
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-2">
            Reasoning Engine
          </div>
        </div>
      </div>

      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
        >
          <span className="text-base leading-none">+</span> New conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading && <p className="px-3 py-2 text-xs text-muted-2">Loading…</p>}
        {!loading && conversations.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-2">
            No conversations yet. Start one above.
          </p>
        )}

        {groups.map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.label} className="mb-3">
                <div className="px-3 pb-1.5 pt-2 text-[10px] font-medium uppercase tracking-widest text-muted-2">
                  {group.label}
                </div>
                {group.items.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                      activeId === c.id
                        ? "bg-surface-raised text-foreground"
                        : "text-muted hover:bg-surface-raised hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">{c.title}</span>
                    <button
                      onClick={(e) => handleDelete(c.id, e)}
                      className="ml-2 hidden flex-shrink-0 text-xs text-muted-2 hover:text-foreground group-hover:block"
                      aria-label="Delete conversation"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="mb-1 flex items-center gap-2 px-1 py-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-surface-raised text-[10px] font-medium text-muted">
            {(userName ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <span className="truncate text-xs text-muted">{userName ?? "Signed in"}</span>
        </div>
        {isAdmin && (
          <Link
            href="/admin"
            className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            Admin panel
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

function groupByRecency(conversations: ConversationSummary[]) {
  const now = Date.now();
  const day = 86_400_000;
  const buckets: Record<string, ConversationSummary[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };

  for (const c of conversations) {
    const diff = now - new Date(c.updatedAt).getTime();
    if (diff < day) buckets.Today.push(c);
    else if (diff < 2 * day) buckets.Yesterday.push(c);
    else if (diff < 7 * day) buckets["Previous 7 days"].push(c);
    else buckets.Older.push(c);
  }

  return Object.entries(buckets).map(([label, items]) => ({ label, items }));
}
