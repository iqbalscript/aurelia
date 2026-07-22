"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

interface ModelOption {
  id: string;
  label: string;
}

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: "BASIC" | "PREMIUM" | "ADMIN";
  createdAt: string;
  modelAccess: string[];
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setModels(data.availableModels ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleModel(user: AdminUser, modelId: string) {
    const has = user.modelAccess.includes(modelId);
    const nextModelIds = has
      ? user.modelAccess.filter((m) => m !== modelId)
      : [...user.modelAccess, modelId];

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, modelAccess: nextModelIds } : u))
    );
    setSavingId(user.id);
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelIds: nextModelIds }),
    });
    setSavingId(null);
  }

  async function changeRole(user: AdminUser, role: AdminUser["role"]) {
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
    setSavingId(user.id);
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setSavingId(null);
  }

  async function deleteUser(user: AdminUser) {
    if (!confirm(`Delete account for ${user.email}? This cannot be undone.`)) return;
    await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="relative min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size={38} />
            <div>
              <Link
                href="/"
                className="text-xs text-muted-2 transition-colors hover:text-foreground"
              >
                ← Back to chat
              </Link>
              <h1 className="font-display mt-0.5 text-2xl italic text-foreground">
                User management
              </h1>
            </div>
          </div>
          <button
            onClick={() => setShowCreate((s) => !s)}
            className="flex-shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            {showCreate ? "Cancel" : "+ Add user"}
          </button>
        </div>

        {showCreate && (
          <CreateUserForm
            models={models}
            onCreated={() => {
              setShowCreate(false);
              refresh();
            }}
          />
        )}

        {loading ? (
          <p className="text-sm text-muted-2">Loading…</p>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-14 text-center">
            <p className="text-sm text-muted">No users yet.</p>
            <p className="mt-1 text-xs text-muted-2">
              Create the first account with the button above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {user.name || "—"}{" "}
                      <span className="font-normal text-muted">{user.email}</span>
                    </p>
                    <p className="text-xs text-muted-2">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                      {savingId === user.id && " · saving…"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        changeRole(user, e.target.value as AdminUser["role"])
                      }
                      className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="BASIC">BASIC</option>
                      <option value="PREMIUM">PREMIUM</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button
                      onClick={() => deleteUser(user)}
                      className="rounded-lg border border-border-subtle px-2 py-1 text-xs text-muted hover:text-foreground"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {user.role === "ADMIN" ? (
                  <p className="text-xs text-muted-2">
                    ADMIN role has access to all models automatically.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {models.map((m) => {
                      const active = user.modelAccess.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleModel(user, m.id)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted hover:border-muted-2 hover:text-foreground"
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateUserForm({
  models,
  onCreated,
}: {
  models: ModelOption[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"BASIC" | "PREMIUM" | "ADMIN">("BASIC");
  const [modelIds, setModelIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(id: string) {
    setModelIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role, modelIds }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create user");
      return;
    }
    onCreated();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 space-y-3 rounded-xl border border-border bg-surface p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          required
          minLength={2}
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          required
          type="password"
          minLength={8}
          placeholder="Password (min. 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Role:</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="BASIC">BASIC</option>
          <option value="PREMIUM">PREMIUM</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>

      {role !== "ADMIN" && (
        <div className="flex flex-wrap gap-2">
          {models.map((m) => {
            const active = modelIds.includes(m.id);
            return (
              <button
                type="button"
                key={m.id}
                onClick={() => toggle(m.id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted hover:border-muted-2 hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-muted">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create User"}
      </button>
    </form>
  );
}
