"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { ExternalLink, Link2, Pencil, Trash2 } from "lucide-react";

function normalizeUrl(input: string): string {
  const t = input.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url.replace(/^https?:\/\//i, "");
  }
}

function QuickLinkCard({
  row,
  userId,
  onEdit,
  onRequestDelete,
}: {
  row: Doc<"quickLinks">;
  userId: string;
  onEdit: () => void;
  onRequestDelete: () => void;
}) {
  const setOgPreviewResult = useMutation(api.quickLinks.setOgPreviewResult);

  useEffect(() => {
    if (row.ogFetchedAt != null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/link-preview?url=${encodeURIComponent(row.url)}`
        );
        if (cancelled) return;
        let image: string | null = null;
        if (res.ok) {
          const data: { image?: string | null } = await res.json();
          image = data?.image ?? null;
        }
        if (cancelled) return;
        await setOgPreviewResult({
          id: row._id,
          userId,
          ...(image ? { ogImageUrl: image } : {}),
        });
      } catch {
        if (!cancelled) {
          await setOgPreviewResult({ id: row._id, userId });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row._id, row.url, row.ogFetchedAt, userId, setOgPreviewResult]);

  const host = displayHost(row.url);
  const hasImage = Boolean(row.ogImageUrl);

  return (
    <li className="h-full min-h-[152px]">
      <div className="relative h-full min-h-[152px] rounded-2xl border border-slate-100 shadow-sm overflow-hidden border-l-[3px] border-l-teal-600">
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-0 flex flex-col justify-end bg-linear-to-br from-green-950 via-teal-900 to-emerald-800 bg-cover bg-center outline-none ring-offset-2 ring-teal-500/50 focus-visible:ring-2"
          style={
            hasImage
              ? {
                  backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.38) 50%, rgba(0,0,0,0.12) 100%), url(${row.ogImageUrl})`,
                }
              : undefined
          }
        >
          {!hasImage && (
            <div className="absolute top-3 left-3 w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <ExternalLink className="w-4 h-4 text-white/70" aria-hidden />
            </div>
          )}
          <div className="relative p-4 pt-12 z-1 pointer-events-none">
            <p
              className="font-semibold truncate text-white drop-shadow-md"
            >
              {row.label}
            </p>
            <p
              className="text-xs truncate mt-0.5 text-white/80 drop-shadow"
            >
              {host}
            </p>
          </div>
        </a>
        <div className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-0.5">
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-lg bg-white/95 text-slate-600 shadow-sm border border-slate-200/90 hover:bg-white hover:text-teal-700 transition-colors"
            aria-label={`Edit ${row.label}`}
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            className="p-1.5 rounded-lg bg-white/95 text-red-600 shadow-sm border border-red-100 hover:bg-red-50 transition-colors"
            aria-label={`Remove ${row.label}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function QuickLinksPage() {
  const { user } = useUser();
  const links = useQuery(api.quickLinks.list, user ? { userId: user.id } : "skip");
  const createLink = useMutation(api.quickLinks.create);
  const updateLink = useMutation(api.quickLinks.update);
  const removeLink = useMutation(api.quickLinks.remove);
  const addSuggested = useMutation(api.quickLinks.addSuggested);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<Id<"quickLinks"> | null>(null);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [deletePendingId, setDeletePendingId] = useState<Id<"quickLinks"> | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setLabel("");
    setUrl("");
    setEditId(null);
    setShowForm(false);
  };

  const openNew = () => {
    setEditId(null);
    setLabel("");
    setUrl("");
    setShowForm(true);
  };

  const openEdit = (id: Id<"quickLinks">) => {
    const row = links?.find((l) => l._id === id);
    if (!row) return;
    setEditId(id);
    setLabel(row.label);
    setUrl(row.url);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmedLabel = label.trim();
    const finalUrl = normalizeUrl(url);
    if (!trimmedLabel || !finalUrl) return;
    setBusy(true);
    try {
      if (editId) {
        await updateLink({
          id: editId,
          userId: user.id,
          label: trimmedLabel,
          url: finalUrl,
        });
      } else {
        await createLink({
          userId: user.id,
          label: trimmedLabel,
          url: finalUrl,
        });
      }
      resetForm();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePendingId || !user) return;
    setBusy(true);
    try {
      await removeLink({ id: deletePendingId, userId: user.id });
      setDeletePendingId(null);
    } finally {
      setBusy(false);
    }
  };

  const handleAddSuggested = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await addSuggested({ userId: user.id });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quick links</h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Shortcuts to your banks and financial sites. The whole card opens the link in a new tab;
            previews use each site&apos;s Open Graph image when available. You can paste{" "}
            <span className="text-slate-600">chase.com</span> or a full URL — https is added when
            needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={handleAddSuggested}
            disabled={busy || !user}
            className="bg-white text-slate-700 border border-slate-200 text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
          >
            Add suggested links
          </button>
          {!showForm && (
            <button
              type="button"
              onClick={openNew}
              className="bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 active:scale-[0.97] transition-all shadow-sm"
            >
              + Add link
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-5">
            {editId ? "Edit link" : "New link"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            <div>
              <label htmlFor="ql-label" className="block text-sm font-medium text-slate-700 mb-1">
                Name
              </label>
              <input
                id="ql-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Chase"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="ql-url" className="block text-sm font-medium text-slate-700 mb-1">
                URL
              </label>
              <input
                id="ql-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.chase.com or chase.com"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                autoComplete="off"
                inputMode="url"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={busy || !label.trim() || !url.trim()}
                className="bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-all"
              >
                {editId ? "Save" : "Add link"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {links === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-100 min-h-[152px] animate-pulse border-l-[3px] border-l-teal-600"
            />
          ))}
        </div>
      ) : links.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Link2 className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-500 mb-1 font-medium">No quick links yet</p>
          <p className="text-slate-500 text-sm mb-5">
            Add your own or use suggested links for Chase, USAA, and other common financial sites.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={handleAddSuggested}
              disabled={busy || !user}
              className="bg-white text-slate-700 border border-slate-200 text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all"
            >
              Add suggested links
            </button>
            <button
              type="button"
              onClick={openNew}
              className="bg-teal-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-teal-700 transition-all"
            >
              Add a link
            </button>
          </div>
        </div>
      ) : user ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((row) => (
            <QuickLinkCard
              key={row._id}
              row={row}
              userId={user.id}
              onEdit={() => openEdit(row._id)}
              onRequestDelete={() => setDeletePendingId(row._id)}
            />
          ))}
        </ul>
      ) : null}

      {deletePendingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-ql-title"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 id="delete-ql-title" className="text-lg font-semibold text-slate-900">
              Remove this link?
            </h2>
            <p className="text-sm text-slate-500">
              You can add it again anytime. This does not affect your budget data.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeletePendingId(null)}
                className="text-slate-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
