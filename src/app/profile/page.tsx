"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

interface Profile {
  name: string | null;
  email: string;
  preferredName: string | null;
  addressInstructions: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferredName, setPreferredName] = useState("");
  const [addressInstructions, setAddressInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        const nextProfile = data.profile as Profile | null;
        setProfile(nextProfile);
        setPreferredName(nextProfile?.preferredName ?? "");
        setAddressInstructions(nextProfile?.addressInstructions ?? "");
      })
      .catch(() => setStatus("Could not load your profile."));
  }, []);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredName: preferredName.trim() || null,
          addressInstructions: addressInstructions.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data.profile);
      setStatus("Profile saved. AURELIA will use it in your next message.");
    } catch {
      setStatus("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
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
            <h1 className="font-display mt-0.5 text-2xl italic text-foreground">Your profile</h1>
          </div>
        </div>

        <p className="mb-6 text-sm text-muted">
          Set the name and wording AURELIA should use when speaking with you. These preferences apply only to your account.
        </p>

        {!profile ? (
          <p className="text-sm text-muted-2">Loading…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-5 rounded-xl border border-border bg-surface p-5">
            <div>
              <p className="text-sm text-foreground">{profile.name ?? profile.email}</p>
              <p className="mt-1 text-xs text-muted-2">{profile.email}</p>
            </div>
            <label className="block text-sm text-foreground">
              What should AURELIA call you?
              <input
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                maxLength={80}
                placeholder="For example: Iqbal, 8Balls, or Rian"
                className="mt-2 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block text-sm text-foreground">
              How should AURELIA speak to you? <span className="text-muted-2">(optional)</span>
              <textarea
                value={addressInstructions}
                onChange={(e) => setAddressInstructions(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="For example: Call me Rian and use a friendly, casual tone."
                className="mt-2 w-full resize-y rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            {status && <p className="text-sm text-muted" aria-live="polite">{status}</p>}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
