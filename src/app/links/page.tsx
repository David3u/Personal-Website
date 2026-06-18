"use client";
/* eslint-disable @next/next/no-img-element */

import {
  ClipboardDocumentIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

type ShortLink = {
  slug: string;
  targetUrl: string;
  createdAt: string;
};

type UploadedFile = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  downloadUrl: string;
};

type ApiError = {
  error?: string;
  retryAfterSeconds?: number;
};

type AdminTab = "downloads" | "links";
type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "none";

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size < 1024) {
    return `${Math.max(0, Math.round(size))} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = -1;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function getPreviewKind(mimeType: string, fileName: string): PreviewKind {
  const mime = mimeType.toLowerCase();
  const extension = fileName.toLowerCase().split(".").pop() ?? "";

  if (mime.startsWith("image/") && mime !== "image/svg+xml") {
    return "image";
  }

  if (mime.startsWith("video/")) {
    return "video";
  }

  if (mime.startsWith("audio/")) {
    return "audio";
  }

  if (mime === "application/pdf" || extension === "pdf") {
    return "pdf";
  }

  if (
    mime === "text/plain" ||
    mime === "application/json" ||
    extension === "txt" ||
    extension === "md" ||
    extension === "json"
  ) {
    return "text";
  }

  return "none";
}

function PreviewPane({
  src,
  kind,
  title,
}: {
  src: string | null;
  kind: PreviewKind;
  title: string;
}) {
  if (!src || kind === "none") {
    return null;
  }

  if (kind === "image") {
    return (
      <div className="preview-frame">
        <img src={src} alt={title} className="h-full w-full object-cover" />
      </div>
    );
  }

  if (kind === "video") {
    return <video src={src} controls className="preview-frame-dark object-cover" />;
  }

  if (kind === "audio") {
    return (
      <div className="preview-frame-dark flex items-center px-4">
        <audio src={src} controls className="w-full" />
      </div>
    );
  }

  if (kind === "pdf" || kind === "text") {
    return <iframe src={src} title={title} className="preview-frame-light" />;
  }

  return null;
}

export default function LinksAdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("downloads");

  const [slug, setSlug] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);

  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState<string | null>(
    null,
  );
  const [uploadLoading, setUploadLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [authLoading, setAuthLoading] = useState(false);

  const [editingOriginalSlug, setEditingOriginalSlug] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState("");
  const [editingTargetUrl, setEditingTargetUrl] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.location.origin;
  }, []);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [],
  );

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFilePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setSelectedFilePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  async function readApiError(response: Response) {
    return (await response.json().catch(() => ({}))) as ApiError;
  }

  async function withLoading(
    setLoading: (value: boolean) => void,
    task: () => Promise<void>,
  ) {
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
      toast.error("Failed to load links.");
      return;
    }

    const data = (await response.json()) as { links?: ShortLink[] };
    setLinks(data.links ?? []);
  }, []);

  const loadUploads = useCallback(async () => {
    const response = await fetch("/links/api/uploads", { cache: "no-store" });
    if (response.status === 401) {
      setAuthenticated(false);
      setUploads([]);
      return;
    }

    if (!response.ok) {
      toast.error("Failed to load uploads.");
      return;
    }

    const data = (await response.json()) as { uploads?: UploadedFile[] };
    setUploads(data.uploads ?? []);
  }, []);

  const checkSession = useCallback(async () => {
    const response = await fetch("/links/api/session", { cache: "no-store" });

    if (!response.ok) {
      setAuthenticated(false);
      setLinks([]);
      setUploads([]);
      return;
    }

    const data = (await response.json()) as { authenticated?: boolean };
    const isAuthed = Boolean(data.authenticated);
    setAuthenticated(isAuthed);

    if (isAuthed) {
      await Promise.all([loadLinks(), loadUploads()]);
    }
  }, [loadLinks, loadUploads]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  function resetSelectedFile() {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function selectFile(file: File | null) {
    setSelectedFile(file);
  }

  function getAbsoluteUrl(pathname: string) {
    return `${baseUrl}${pathname}`;
  }

  function getUploadPreviewUrl(id: string) {
    return `/links/api/uploads/${id}/preview`;
  }

  function formatCreatedAt(value: string) {
    return dateFormatter.format(new Date(value));
  }

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${label} to clipboard.`);
    } catch {
      toast.error("Clipboard copy failed.");
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await withLoading(setAuthLoading, async () => {
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
        toast.error(`${data.error ?? "Login failed."}${retryText}`);
        return;
      }

      setPassword("");
      setAuthenticated(true);
      await Promise.all([loadLinks(), loadUploads()]);
    });
  }

  async function handleLogout() {
    await fetch("/links/api/logout", { method: "POST" });
    setAuthenticated(false);
    setLinks([]);
    setUploads([]);
    cancelEdit();
    resetSelectedFile();
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await withLoading(setLinkLoading, async () => {
      const response = await fetch("/links/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, targetUrl }),
      });

      if (!response.ok) {
        const data = await readApiError(response);
        toast.error(data.error ?? "Failed to create short link.");
        return;
      }

      const createdSlug = slug.trim().toLowerCase();
      setSlug("");
      setTargetUrl("");
      toast.success(`Created ${baseUrl}/${createdSlug}`);
      await loadLinks();
    });
  }

  function beginEdit(link: ShortLink) {
    setEditingOriginalSlug(link.slug);
    setEditingSlug(link.slug);
    setEditingTargetUrl(link.targetUrl);
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

    await withLoading(setLinkLoading, async () => {
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
        toast.error(data.error ?? "Failed to update link.");
        return;
      }

      const updatedSlug = editingSlug.trim().toLowerCase();
      toast.success(`Updated ${baseUrl}/${updatedSlug}`);
      cancelEdit();
      await loadLinks();
    });
  }

  async function handleDelete(linkSlug: string) {
    if (!window.confirm(`Delete ${baseUrl}/${linkSlug}?`)) {
      return;
    }

    await withLoading(setLinkLoading, async () => {
      const response = await fetch(`/links/api/items/${encodeURIComponent(linkSlug)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await readApiError(response);
        toast.error(data.error ?? "Failed to delete link.");
        return;
      }

      if (editingOriginalSlug === linkSlug) {
        cancelEdit();
      }

      toast.success(`Deleted ${baseUrl}/${linkSlug}`);
      await loadLinks();
    });
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      toast.error("Choose a file to upload.");
      return;
    }

    await withLoading(setUploadLoading, async () => {
      const formData = new FormData();
      formData.set("file", selectedFile);

      const response = await fetch("/links/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await readApiError(response);
        toast.error(data.error ?? "Failed to upload file.");
        return;
      }

      const data = (await response.json()) as { upload?: UploadedFile };
      const upload = data.upload;
      resetSelectedFile();
      toast.success(
        upload ? `Uploaded ${getAbsoluteUrl(upload.downloadUrl)}` : "Upload complete.",
      );
      await loadUploads();
    });
  }

  async function handleDeleteUpload(upload: UploadedFile) {
    if (!window.confirm(`Delete ${upload.originalName}?`)) {
      return;
    }

    await withLoading(setUploadLoading, async () => {
      const response = await fetch(
        `/links/api/uploads/${encodeURIComponent(upload.id)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = await readApiError(response);
        toast.error(data.error ?? "Failed to delete upload.");
        return;
      }

      toast.success(`Deleted ${upload.originalName}.`);
      await loadUploads();
    });
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
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
          <section className="panel-admin w-full max-w-md !rounded-[1.5rem] !bg-[linear-gradient(180deg,#111113_0%,#0c0c0e_100%)] !p-8">
            <h1 className="heading-section mb-2">Links</h1>
            <p className="text-body-sm mb-6">
              Sign in to manage links and personal downloads.
            </p>

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
                  className="input-shell"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full justify-center"
                disabled={authLoading}
              >
                {authLoading ? "Checking..." : "Sign In"}
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  const selectedFileKind = selectedFile
    ? getPreviewKind(selectedFile.type, selectedFile.name)
    : "none";
  const selectedFileHasPreview =
    Boolean(selectedFilePreviewUrl) && selectedFileKind !== "none";

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-[#fafafa]">
      <div className="container-resume py-16">
        <div className="mb-10 flex flex-col gap-6 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="min-w-0">
            <h1 className="heading-section">Links and Downloads</h1>
          </div>

          <div className="flex justify-center">
            <div className="tab-pill-group">
              <button
                type="button"
                className={`tab-pill ${
                  activeTab === "downloads" ? "tab-pill-active" : ""
                }`}
                onClick={() => setActiveTab("downloads")}
              >
                Downloads
              </button>
              <button
                type="button"
                className={`tab-pill ${activeTab === "links" ? "tab-pill-active" : ""}`}
                onClick={() => setActiveTab("links")}
              >
                Links
              </button>
            </div>
          </div>

          <div className="flex justify-start md:justify-end">
            <button onClick={handleLogout} className="btn-secondary">
              Log Out
            </button>
          </div>
        </div>

        {activeTab === "downloads" ? (
          <div key="downloads" className="space-y-8">
            <section className="panel-admin">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="heading-card">Upload File</h2>
                </div>
                {selectedFile ? (
                  <p className="text-caption">Ready to upload</p>
                ) : (
                  <p className="text-caption">Choose one file</p>
                )}
              </div>

              <form
                onSubmit={handleUpload}
                className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileInputChange}
                />

                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => {
                    if (!selectedFile && !uploadLoading) {
                      fileInputRef.current?.click();
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      !selectedFile &&
                      !uploadLoading &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  role={!selectedFile ? "button" : undefined}
                  tabIndex={!selectedFile ? 0 : -1}
                  aria-label={!selectedFile ? "Choose a file to upload" : undefined}
                  className={`dropzone !px-4 ${!selectedFile ? "!py-0 md:min-h-12" : ""} ${isDragging ? "dropzone-active" : ""}`}
                >
                  {!selectedFile ? (
                    <div className="flex flex-col gap-2 py-2 md:min-h-12 md:flex-row md:items-center md:py-0">
                      <p className="m-0 text-body-sm leading-none">
                        <span className="font-medium text-[#fafafa]">
                          Drag a file here
                        </span>{" "}
                        or pick one from your computer
                      </p>
                    </div>
                  ) : (
                    <div
                      className={`grid gap-4 ${
                        selectedFileHasPreview
                          ? "lg:grid-cols-[minmax(0,180px)_1fr]"
                          : "lg:grid-cols-1"
                      }`}
                    >
                      {selectedFileHasPreview ? (
                        <PreviewPane
                          src={selectedFilePreviewUrl}
                          kind={selectedFileKind}
                          title={selectedFile.name}
                        />
                      ) : null}

                      <div className="flex min-w-0 flex-col justify-between gap-4">
                        <div>
                          <p className="truncate font-medium text-[#fafafa]">
                            {selectedFile.name}
                          </p>
                          <p className="text-body-sm mt-1.5">
                            {`${formatBytes(selectedFile.size)}${
                              selectedFile.type ? ` • ${selectedFile.type}` : ""
                            }`}
                          </p>
                        </div>

                        <div>
                          <button
                            type="button"
                            className="btn-secondary justify-center"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadLoading}
                          >
                            Change File
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 xl:justify-self-end">
                  {selectedFile ? (
                    <button
                      type="button"
                      className="btn-secondary justify-center"
                      onClick={resetSelectedFile}
                      disabled={uploadLoading}
                    >
                      Clear
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="btn-primary justify-center"
                    disabled={uploadLoading || !selectedFile}
                  >
                    {uploadLoading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </form>
            </section>
            <section className="panel-admin">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="heading-card">Uploaded Files</h2>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-caption">{uploads.length} file(s)</p>
                </div>
              </div>

              {uploads.length === 0 ? (
                <p className="text-body-sm">No uploaded files yet.</p>
              ) : (
                <div className="space-y-4">
                  {uploads.map((upload) => {
                    const absoluteDownloadUrl = getAbsoluteUrl(upload.downloadUrl);
                    const previewUrl = getUploadPreviewUrl(upload.id);
                    const previewKind = getPreviewKind(
                      upload.mimeType,
                      upload.originalName,
                    );
                    const hasPreview = previewKind !== "none";

                    return (
                      <div key={upload.id} className="panel-row">
                        <div
                          className={`grid gap-4 ${
                            hasPreview
                              ? "lg:grid-cols-[minmax(0,180px)_1fr_auto]"
                              : "lg:grid-cols-[1fr_auto]"
                          } lg:items-start`}
                        >
                          {hasPreview ? (
                            <PreviewPane
                              src={previewUrl}
                              kind={previewKind}
                              title={upload.originalName}
                            />
                          ) : null}

                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#fafafa]">
                              {upload.originalName}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#a1a1aa]">
                              <span>{formatBytes(upload.size)}</span>
                              <span>{formatCreatedAt(upload.createdAt)}</span>
                              {upload.mimeType ? <span>{upload.mimeType}</span> : null}
                            </div>
                            <button
                              type="button"
                              className="mt-3 block max-w-full truncate text-left text-sm text-[#fbbf24] hover:underline"
                              onClick={() =>
                                copyToClipboard(
                                  absoluteDownloadUrl,
                                  absoluteDownloadUrl,
                                )
                              }
                            >
                              {absoluteDownloadUrl}
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2 lg:flex-col lg:items-center">
                            <button
                              type="button"
                              className="btn-secondary-icon"
                              onClick={() =>
                                copyToClipboard(absoluteDownloadUrl, "download link")
                              }
                              aria-label={`Copy link for ${upload.originalName}`}
                              title="Copy link"
                            >
                              <ClipboardDocumentIcon className="h-4.5 w-4.5" />
                            </button>
                            <button
                              type="button"
                              className="btn-danger-icon"
                              onClick={() => handleDeleteUpload(upload)}
                              disabled={uploadLoading}
                              aria-label={`Delete ${upload.originalName}`}
                              title="Delete"
                            >
                              <TrashIcon className="h-4.5 w-4.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div key="links" className="space-y-8">
            <section className="panel-admin">
              <div className="mb-5">
                <h2 className="heading-card">Create Link</h2>
              </div>

              <form
                onSubmit={handleCreate}
                className="grid gap-4 md:grid-cols-[220px_1fr_auto]"
              >
                <input
                  type="text"
                  placeholder="short code (e.g. yt)"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  className="input-shell"
                  required
                />
                <input
                  type="text"
                  placeholder="destination URL (e.g. youtube.com)"
                  value={targetUrl}
                  onChange={(event) => setTargetUrl(event.target.value)}
                  className="input-shell"
                  required
                />
                <button
                  type="submit"
                  className="btn-primary justify-center"
                  disabled={linkLoading}
                >
                  {linkLoading ? "Saving..." : "Create"}
                </button>
              </form>
            </section>

            <section className="panel-admin">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="heading-card">Existing Links</h2>
                </div>
                <p className="text-caption">{links.length} link(s)</p>
              </div>

              {links.length === 0 ? (
                <p className="text-body-sm">No links yet.</p>
              ) : (
                <div className="space-y-3">
                  {links.map((link) => {
                    const isEditing = editingOriginalSlug === link.slug;
                    const shortUrl = `${baseUrl}/${link.slug}`;

                    return (
                      <div key={link.slug} className="panel-row">
                        {isEditing ? (
                          <form
                            onSubmit={saveEdit}
                            className="grid gap-3 md:grid-cols-[180px_1fr_auto_auto]"
                          >
                            <input
                              type="text"
                              value={editingSlug}
                              onChange={(event) => setEditingSlug(event.target.value)}
                              className="input-shell-subtle"
                              required
                            />
                            <input
                              type="text"
                              value={editingTargetUrl}
                              onChange={(event) =>
                                setEditingTargetUrl(event.target.value)
                              }
                              className="input-shell-subtle"
                              required
                            />
                            <button
                              type="submit"
                              className="btn-primary justify-center"
                              disabled={linkLoading}
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
                            <div className="min-w-0">
                              <button
                                type="button"
                                className="font-medium text-[#fbbf24] hover:underline"
                                onClick={() => copyToClipboard(shortUrl, shortUrl)}
                              >
                                {shortUrl}
                              </button>
                              <button
                                type="button"
                                className="mt-1 block max-w-full truncate text-left text-[#a1a1aa] hover:text-[#fafafa]"
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
                                className="btn-secondary-icon"
                                onClick={() => beginEdit(link)}
                                disabled={linkLoading}
                                aria-label={`Edit ${link.slug}`}
                                title="Edit"
                              >
                                <PencilSquareIcon className="h-4.5 w-4.5" />
                              </button>
                              <button
                                type="button"
                                className="btn-danger-icon"
                                onClick={() => handleDelete(link.slug)}
                                disabled={linkLoading}
                                aria-label={`Delete ${link.slug}`}
                                title="Delete"
                              >
                                <TrashIcon className="h-4.5 w-4.5" />
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
        )}
      </div>
    </main>
  );
}
