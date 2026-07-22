"use client";

import { useEffect, useRef, useState } from "react";

interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export function ModelSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (modelId: string) => void;
}) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models ?? []);
        if (!value && data.models?.[0]) onChange(data.models[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (models.length === 0) {
    return (
      <span className="text-xs text-muted-2">
        No models available for your account — contact your admin.
      </span>
    );
  }

  const active = models.find((m) => m.id === value) ?? models[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-raised"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
        {active?.label}
        <Chevron open={open} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-lg">
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className={`block w-full border-b border-border-subtle px-3.5 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-surface-hover ${
                m.id === value ? "bg-surface-hover" : ""
              }`}
            >
              <div className="font-medium text-foreground">{m.label}</div>
              <div className="mt-0.5 text-xs text-muted">{m.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`text-muted-2 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
