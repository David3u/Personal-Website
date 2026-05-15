"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ShortLink = {
  slug: string;
  targetUrl: string;
  createdAt: string;
};

type ApiError = {
  error?: string;
  retryAfterSeconds?: number;
};

const INPUT_CLASS =
  "w-full rounded-md border border-[#27272a] bg-[#111113] px-3 py-2 text-sm outline-none";
const EDIT_INPUT_CLASS =
  "w-full rounded-md border border-[#27272a] bg-[#0f0f11] px-3 py-2 text-sm outline-none";

export default function LinksAdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [slug, setSlug] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loginError, setLoginError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingOriginalSlug, setEditingOriginalSlug] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState("");
  const [editingTargetUrl, setEditingTargetUrl] = useState("");

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.location.origin;
  }, []);

  async function readApiError(response: Response) {
    return (await response.json().catch(() => ({}))) as ApiError;
  }

  function clearActionMessages() {
    setActionError("");
    setActionSuccess("");
  }

  async function withLoading(task: () => Promise<void>) {
    setLoading(true);
    try {
      await task();
    } finally {
      setLoading(false);
    }
  }

  const loadLinks = useCallback(async () => {
    const response = await fetch("/links/api/items", { cache: "no-store" });
    if (response.status === 401) {
      setAuthenticated(false);
      setLinks([]);
      return;
    }

    if (!response.ok) {
      setActionError("Failed to load links.");
      return;
    }

    const data = (await response.json()) as { links?: ShortLink[] };
    setLinks(data.links ?? []);
  }, []);

  const checkSession = useCallback(async () => {
    const response = await fetch("/links/api/session", { cache: "no-store" });

    if (!response.ok) {
      setAuthenticated(false);
      setLinks([]);
      return;
    }

    const data = (await response.json()) as { authenticated?: boolean };
    const isAuthed = Boolean(data.authenticated);
    setAuthenticated(isAuthed);

    if (isAuthed) {
      await loadLinks();
    }
  }, [loadLinks]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    await withLoading(async () => {
      const response = await fetch("/links/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await readApiError(response);
        const retryText = data.retryAfterSeconds
          ? ` Try again in ${Math.max(1, Math.ceil(data.retryAfterSeconds / 60))} minute(s).`
          : "";
        setLoginError(`${data.error ?? "Login failed."}${retryText}`);
        return;
      }

      setPassword("");
      setAuthenticated(true);
      await loadLinks();
    });
  }

  async function handleLogout() {
    await fetch("/links/api/logout", { method: "POST" });
    setAuthenticated(false);
    setLinks([]);
    setActionSuccess("");
    setActionError("");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearActionMessages();
    await withLoading(async () => {
      const response = await fetch("/links/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, targetUrl }),
      });

      if (!response.ok) {
        const data = await readApiError(response);
        setActionError(data.error ?? "Failed to create short link.");
        return;
      }

      const createdSlug = slug.trim().toLowerCase();
      setSlug("");
      setTargetUrl("");
      setActionSuccess(`Created ${baseUrl}/${createdSlug}`);
      await loadLinks();
    });
  }

  function beginEdit(link: ShortLink) {
    setEditingOriginalSlug(link.slug);
    setEditingSlug(link.slug);
    setEditingTargetUrl(link.targetUrl);
    setActionError("");
    setActionSuccess("");
  }

  function cancelEdit() {
    setEditingOriginalSlug(null);
    setEditingSlug("");
    setEditingTargetUrl("");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingOriginalSlug) {
      return;
    }

    clearActionMessages();
    await withLoading(async () => {
      const response = await fetch(
        `/links/api/items/${encodeURIComponent(editingOriginalSlug)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: editingSlug, targetUrl: editingTargetUrl }),
        },
      );

      if (!response.ok) {
        const data = await readApiError(response);
        setActionError(data.error ?? "Failed to update link.");
        return;
      }

      const updatedSlug = editingSlug.trim().toLowerCase();
      setActionSuccess(`Updated ${baseUrl}/${updatedSlug}`);
      cancelEdit();
      await loadLinks();
    });
  }

  async function handleDelete(linkSlug: string) {
    if (!window.confirm(`Delete ${baseUrl}/${linkSlug}?`)) {
      return;
    }

    clearActionMessages();
    await withLoading(async () => {
      const response = await fetch(`/links/api/items/${encodeURIComponent(linkSlug)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await readApiError(response);
        setActionError(data.error ?? "Failed to delete link.");
        return;
      }

      if (editingOriginalSlug === linkSlug) {
        cancelEdit();
      }

      setActionSuccess(`Deleted ${baseUrl}/${linkSlug}`);
      await loadLinks();
    });
  }

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      clearActionMessages();
      setActionSuccess(`Copied ${label} to clipboard.`);
    } catch {
      setActionSuccess("");
      setActionError("Clipboard copy failed.");
    }
  }

  if (authenticated === null) {
    return (
      <main className="min-h-screen bg-[#0a0a0b] text-[#fafafa]">
        <div className="container-resume py-24">Loading...</div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[#0a0a0b] text-[#fafafa]">
        <div className="container-resume flex min-h-screen items-center justify-center py-16">
          <section className="card w-full max-w-md">
            <h1 className="heading-section mb-2">Links Admin</h1>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="password" className="text-caption mb-2 block">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={INPUT_CLASS}
                  required
                />
              </div>

              {loginError ? <p className="text-sm text-red-400">{loginError}</p> : null}

              <button
                type="submit"
                className="btn-primary w-full justify-center"
                disabled={loading}
              >
                {loading ? "Checking..." : "Sign In"}
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-[#fafafa]">
      <div className="container-resume py-16">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="heading-section">Links</h1>
          </div>

          <button onClick={handleLogout} className="btn-secondary">
            Log Out
          </button>
        </div>

        <section className="card mb-8">
          <h2 className="heading-card mb-4">Create Link</h2>
          <form
            onSubmit={handleCreate}
            className="grid gap-4 md:grid-cols-[220px_1fr_auto]"
          >
            <input
              type="text"
              placeholder="short code (e.g. yt)"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className={INPUT_CLASS}
              required
            />
            <input
              type="text"
              placeholder="destination URL (e.g. youtube.com)"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              className={INPUT_CLASS}
              required
            />
            <button
              type="submit"
              className="btn-primary justify-center"
              disabled={loading}
            >
              {loading ? "Saving..." : "Create"}
            </button>
          </form>

          {actionError ? (
            <p className="mt-3 text-sm text-red-400">{actionError}</p>
          ) : null}
          {actionSuccess ? (
            <p className="mt-3 text-sm text-green-400">{actionSuccess}</p>
          ) : null}
        </section>

        <section className="card">
          <h2 className="heading-card mb-4">Existing Links</h2>

          {links.length === 0 ? (
            <p className="text-body-sm">No links yet.</p>
          ) : (
            <div className="space-y-3">
              {links.map((link) => {
                const isEditing = editingOriginalSlug === link.slug;

                return (
                  <div
                    key={link.slug}
                    className="rounded-md border border-[#27272a] bg-[#111113] px-4 py-3 text-sm"
                  >
                    {isEditing ? (
                      <form
                        onSubmit={saveEdit}
                        className="grid gap-3 md:grid-cols-[180px_1fr_auto_auto]"
                      >
                        <input
                          type="text"
                          value={editingSlug}
                          onChange={(event) => setEditingSlug(event.target.value)}
                          className={EDIT_INPUT_CLASS}
                          required
                        />
                        <input
                          type="text"
                          value={editingTargetUrl}
                          onChange={(event) => setEditingTargetUrl(event.target.value)}
                          className={EDIT_INPUT_CLASS}
                          required
                        />
                        <button
                          type="submit"
                          className="btn-primary justify-center"
                          disabled={loading}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn-secondary justify-center"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                        <div>
                          <button
                            type="button"
                            className="font-medium text-[#fbbf24] hover:underline"
                            onClick={() =>
                              copyToClipboard(
                                `${baseUrl}/${link.slug}`,
                                `${baseUrl}/${link.slug}`,
                              )
                            }
                          >
                            {baseUrl}/{link.slug}
                          </button>
                          <button
                            type="button"
                            className="mt-1 block max-w-full truncate text-[#a1a1aa] hover:text-[#fafafa]"
                            onClick={() =>
                              copyToClipboard(link.targetUrl, link.targetUrl)
                            }
                          >
                            {link.targetUrl}
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-secondary px-3 py-2"
                            onClick={() => beginEdit(link)}
                            disabled={loading}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-red-500/40 px-3 py-2 text-red-300 transition hover:border-red-400 hover:bg-red-500/10"
                            onClick={() => handleDelete(link.slug)}
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
