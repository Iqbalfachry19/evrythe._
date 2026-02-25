import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { addNovel, getNovels } from "@/lib/novels-store";
import { isAdminEmail } from "@/lib/admin";

type CreateNovelPayload = {
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

export async function GET() {
  const novels = await getNovels();
  return NextResponse.json({ novels });
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
    const body = (await request.json()) as CreateNovelPayload;
    const title = body.title?.trim() ?? "";
    const author = body.author?.trim() ?? "";
    const description = body.description?.trim() ?? "";
    const coverImage = body.coverImage?.trim() ?? "";
    const ebookDriveUrl = body.ebookDriveUrl?.trim() ?? "";
    const priceUsd = Number(body.priceUsd ?? 0);
    const priceIdr = Number(body.priceIdr ?? 0);

    if (
      !title ||
      !author ||
      !description ||
      !coverImage ||
      !ebookDriveUrl ||
      !Number.isFinite(priceUsd) ||
      !Number.isFinite(priceIdr) ||
      priceUsd <= 0 ||
      priceIdr <= 0
    ) {
      return NextResponse.json(
        { error: "Data produk tidak valid." },
        { status: 400 },
      );
    }

    if (!isValidImagePath(coverImage)) {
      return NextResponse.json(
        { error: "Cover image harus URL http(s) atau path lokal (/...)." },
        { status: 400 },
      );
    }

    if (!ebookDriveUrl.startsWith("http://") && !ebookDriveUrl.startsWith("https://")) {
      return NextResponse.json(
        { error: "Link eBook harus URL http(s)." },
        { status: 400 },
      );
    }

    const novel = await addNovel({
      title,
      author,
      description,
      priceUsd,
      priceIdr,
      coverImage,
      ebookDriveUrl,
    });

    return NextResponse.json({ novel }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Gagal menambahkan produk." },
      { status: 500 },
    );
  }
}
