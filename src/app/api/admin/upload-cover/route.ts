import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { isAdminEmail } from "@/lib/admin";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function extensionFromMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/svg+xml") return "svg";
  return null;
}

export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Silakan login dulu." },
      { status: 401 },
    );
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json(
      { error: "Forbidden. Akun ini bukan admin." },
      { status: 403 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "File gambar tidak ditemukan." },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File harus berupa gambar." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Ukuran file maksimal 5MB." },
        { status: 400 },
      );
    }

    const ext = extensionFromMime(file.type);
    if (!ext) {
      return NextResponse.json(
        { error: "Format gambar belum didukung (gunakan png/jpg/webp/svg)." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `cover-${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;

    const relativeDir = "books";
    const absoluteDir = path.join(process.cwd(), "public", relativeDir);
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(path.join(absoluteDir, fileName), buffer);

    const publicUrl = `/${relativeDir}/${fileName}`.replace(/\\/g, "/");
    return NextResponse.json({ url: publicUrl }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Gagal upload gambar cover." },
      { status: 500 },
    );
  }
}
