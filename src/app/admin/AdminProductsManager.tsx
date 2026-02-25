"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Novel } from "@/lib/novels";

type FormState = {
  title: string;
  author: string;
  description: string;
  priceUsd: string;
  priceIdr: string;
  coverImage: string;
  ebookDriveUrl: string;
};

const INITIAL_FORM: FormState = {
  title: "",
  author: "EVR!T",
  description: "",
  priceUsd: "",
  priceIdr: "",
  coverImage: "",
  ebookDriveUrl: "",
};

export default function AdminProductsManager() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const modeLabel = useMemo(
    () => (editingId ? "Update Product" : "Add Product"),
    [editingId],
  );

  const loadNovels = useCallback(async () => {
    try {
      const response = await fetch("/api/novels", { cache: "no-store" });
      const data = (await response.json()) as { novels?: Novel[] };
      if (!response.ok || !Array.isArray(data.novels)) {
        return;
      }
      setNovels(data.novels);
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    void loadNovels();
  }, [loadNovels]);

  function resetForm() {
    setForm(INITIAL_FORM);
    setCoverFile(null);
    setEditingId(null);
  }

  async function handleCoverUpload() {
    if (!coverFile) {
      setError("Pilih file cover dulu.");
      return;
    }

    try {
      setUploadingCover(true);
      setError(null);
      setSuccess(null);

      const payload = new FormData();
      payload.append("file", coverFile);

      const response = await fetch("/api/admin/upload-cover", {
        method: "POST",
        body: payload,
      });

      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Gagal upload cover.");
      }

      setForm((prev) => ({ ...prev, coverImage: data.url! }));
      setSuccess("Cover berhasil diupload.");
      setCoverFile(null);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Terjadi kesalahan.";
      setError(message);
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const endpoint = editingId ? `/api/novels/${editingId}` : "/api/novels";
      const method = editingId ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          priceUsd: Number(form.priceUsd),
          priceIdr: Number(form.priceIdr),
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        novel?: Novel;
      };

      if (!response.ok || !data.novel) {
        throw new Error(data.error || "Gagal menyimpan produk.");
      }

      const action = editingId ? "diperbarui" : "ditambahkan";
      setSuccess(`Produk "${data.novel.title}" berhasil ${action}.`);
      resetForm();
      await loadNovels();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Terjadi kesalahan.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    const confirmed = window.confirm(`Hapus produk "${title}"?`);
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/novels/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Gagal menghapus produk.");
      }

      if (editingId === id) {
        resetForm();
      }
      setSuccess(`Produk "${title}" berhasil dihapus.`);
      await loadNovels();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Terjadi kesalahan.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(novel: Novel) {
    setEditingId(novel.id);
    setForm({
      title: novel.title,
      author: novel.author,
      description: novel.description,
      priceUsd: String(novel.priceUsd),
      priceIdr: String(novel.priceIdr),
      coverImage: novel.coverImage,
      ebookDriveUrl: novel.ebookDriveUrl,
    });
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="m-4 rounded-3xl border border-indigo-900 bg-indigo-50 p-6 text-indigo-950 shadow-[8px_8px_0_0_rgba(30,27,75,0.9)]">
      <section className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className="text-xs font-semibold tracking-[0.3em] text-indigo-600">ADMIN</p>
          <h1 className="mt-2 text-4xl font-bold">Manage Novel Products</h1>
          <p className="mt-2 text-sm text-indigo-700">
            Login sebagai admin untuk create, edit, dan delete produk.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-2xl border border-indigo-300 bg-white p-5 shadow-md md:grid-cols-2"
        >
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Title"
            className="rounded-lg border border-indigo-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300 md:col-span-2"
            required
          />
          <input
            value={form.author}
            onChange={(event) => setForm((prev) => ({ ...prev, author: event.target.value }))}
            placeholder="Author"
            className="rounded-lg border border-indigo-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            required
          />
          <input
            value={form.coverImage}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, coverImage: event.target.value }))
            }
            placeholder="Cover URL atau path upload"
            className="rounded-lg border border-indigo-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            required
          />
          <div className="space-y-2">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleCoverUpload()}
              disabled={uploadingCover || !coverFile}
              className="rounded-lg border border-indigo-400 bg-indigo-100 px-3 py-2 text-xs font-semibold text-indigo-900 transition hover:bg-indigo-200 disabled:opacity-60"
            >
              {uploadingCover ? "Uploading..." : "Upload Cover"}
            </button>
          </div>
          <input
            value={form.priceUsd}
            onChange={(event) => setForm((prev) => ({ ...prev, priceUsd: event.target.value }))}
            placeholder="Price USD (e.g. 12.99)"
            type="number"
            min="0.01"
            step="0.01"
            className="rounded-lg border border-indigo-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            required
          />
          <input
            value={form.priceIdr}
            onChange={(event) => setForm((prev) => ({ ...prev, priceIdr: event.target.value }))}
            placeholder="Price IDR (e.g. 199000)"
            type="number"
            min="1"
            step="1"
            className="rounded-lg border border-indigo-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            required
          />
          <input
            value={form.ebookDriveUrl}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, ebookDriveUrl: event.target.value }))
            }
            placeholder="eBook URL"
            className="rounded-lg border border-indigo-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300 md:col-span-2"
            required
          />
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="Description"
            rows={4}
            className="rounded-lg border border-indigo-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300 md:col-span-2"
            required
          />
          {form.coverImage ? (
            <div className="md:col-span-2">
              <p className="mb-1 text-xs font-semibold text-indigo-700">Preview Cover</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.coverImage}
                alt="Preview cover"
                className="h-48 w-32 rounded-md border border-indigo-200 object-cover"
              />
            </div>
          ) : null}
          <div className="flex gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={loading || uploadingCover}
              className="rounded-lg border border-indigo-500 bg-indigo-300 px-5 py-2 font-semibold text-indigo-950 transition hover:bg-indigo-400 disabled:opacity-60"
            >
              {loading ? "Saving..." : modeLabel}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-indigo-300 bg-white px-5 py-2 font-semibold text-indigo-800 transition hover:bg-indigo-100"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>

        {error ? (
          <p className="rounded-lg border border-red-400 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="rounded-lg border border-emerald-400 bg-emerald-50 p-3 text-sm text-emerald-700">
            {success}
          </p>
        ) : null}

        <section className="rounded-2xl border border-indigo-300 bg-white p-5 shadow-md">
          <h2 className="text-2xl font-bold">Current Products ({novels.length})</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-indigo-200 text-indigo-700">
                  <th className="px-2 py-2">ID</th>
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">USD</th>
                  <th className="px-2 py-2">IDR</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {novels.map((novel) => (
                  <tr key={novel.id} className="border-b border-indigo-100">
                    <td className="px-2 py-2 font-mono text-xs">{novel.id}</td>
                    <td className="px-2 py-2">{novel.title}</td>
                    <td className="px-2 py-2">USD {novel.priceUsd.toFixed(2)}</td>
                    <td className="px-2 py-2">
                      Rp {novel.priceIdr.toLocaleString("id-ID")}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(novel)}
                          className="rounded-md border border-indigo-300 bg-white px-2 py-1 text-xs font-semibold text-indigo-800 transition hover:bg-indigo-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(novel.id, novel.title)}
                          className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
