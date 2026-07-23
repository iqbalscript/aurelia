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
  open,
  onToggle,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  userName?: string | null;
  isAdmin?: boolean;
  open: boolean;
  onToggle: () => void;
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

  const groups = groupByRecency(conversations);

  return (
    <aside
      className={`flex h-full flex-shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200 ease-in-out ${
        open ? "w-72" : "w-0 border-r-0"
      }`}
    >
      {/* Inner content is fixed width so it doesn't get squished/wrapped
          during the collapse animation — the parent width is what animates. */}
      <div className="flex h-full w-72 flex-col">
        <div className="flex items-center justify-between gap-2.5 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Logo size={30} />
            <div className="min-w-0 leading-none">
              <div className="font-display truncate text-xl tracking-brand text-foreground">
                AURELIA
              </div>
              <div className="mt-0.5 truncate text-[10px] uppercase tracking-widest text-muted-2">
                Reasoning Engine
              </div>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <SidebarIcon />
          </button>
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
                      className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-[15px] transition-colors ${
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
          <div className="mb-2 flex items-center gap-2 rounded-lg px-2 py-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-raised text-[11px] font-medium text-muted">
              {(userName ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <span
              className="truncate text-xs text-muted"
              title={userName ?? undefined}
            >
              {userName ?? "Signed in"}
            </span>
          </div>

          <div className="space-y-0.5">
            {isAdmin && (
              <Link
                href="/admin"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
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
        </div>
      </div>
    </aside>
  );
}

function SidebarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <line x1="6" y1="2.5" x2="6" y2="13.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
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