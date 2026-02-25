import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { isAdminEmail } from "@/lib/admin";
import {
  deleteNovelById,
  findNovelById,
  updateNovelById,
} from "@/lib/novels-store";

type UpdateNovelPayload = {
  title?: string;
  author?: string;
  description?: string;
  priceUsd?: number | string;
  priceIdr?: number | string;
  coverImage?: string;
  ebookDriveUrl?: string;
};

function isValidImagePath(value: string) {
  return value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://");
}

function parseInput(body: UpdateNovelPayload) {
  const title = body.title?.trim() ?? "";
  const author = body.author?.trim() ?? "";
  const description = body.description?.trim() ?? "";
  const coverImage = body.coverImage?.trim() ?? "";
  const ebookDriveUrl = body.ebookDriveUrl?.trim() ?? "";
  const priceUsd = Number(body.priceUsd ?? 0);
  const priceIdr = Number(body.priceIdr ?? 0);

  return {
    title,
    author,
    description,
    coverImage,
    ebookDriveUrl,
    priceUsd,
    priceIdr,
  };
}

function isInputValid(input: ReturnType<typeof parseInput>) {
  return (
    !!input.title &&
    !!input.author &&
    !!input.description &&
    !!input.coverImage &&
    !!input.ebookDriveUrl &&
    Number.isFinite(input.priceUsd) &&
    Number.isFinite(input.priceIdr) &&
    input.priceUsd > 0 &&
    input.priceIdr > 0 &&
    isValidImagePath(input.coverImage) &&
    (input.ebookDriveUrl.startsWith("http://") ||
      input.ebookDriveUrl.startsWith("https://"))
  );
}

function requireAdmin(request: NextRequest) {
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

  return null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const novel = await findNovelById(id);
  if (!novel) {
    return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ novel });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const adminError = requireAdmin(request);
  if (adminError) {
    return adminError;
  }

  const { id } = await context.params;
  try {
    const body = (await request.json()) as UpdateNovelPayload;
    const input = parseInput(body);
    if (!isInputValid(input)) {
      return NextResponse.json(
        { error: "Data produk tidak valid." },
        { status: 400 },
      );
    }

    const novel = await updateNovelById(id, input);
    if (!novel) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan." },
        { status: 404 },
      );
    }

    return NextResponse.json({ novel });
  } catch {
    return NextResponse.json(
      { error: "Gagal mengubah produk." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const adminError = requireAdmin(request);
  if (adminError) {
    return adminError;
  }

  const { id } = await context.params;
  const deleted = await deleteNovelById(id);
  if (!deleted) {
    return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
