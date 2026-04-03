import { NextRequest, NextResponse } from "next/server";

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function findMetaContent(
  html: string,
  attr: "property" | "name",
  key: string
): string | undefined {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const p1 = new RegExp(
    `<meta[^>]+${attr}=["']${esc}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const p2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${esc}["']`,
    "i"
  );
  const m = html.match(p1) ?? html.match(p2);
  const raw = m?.[1];
  return raw?.trim() ? decodeBasicEntities(raw.trim()) : undefined;
}

function findOgImage(html: string): string | undefined {
  const candidates: Array<readonly ["property" | "name", string]> = [
    ["property", "og:image:secure_url"],
    ["property", "og:image"],
    ["name", "twitter:image:src"],
    ["name", "twitter:image"],
  ];
  for (const [attr, key] of candidates) {
    const v = findMetaContent(html, attr, key);
    if (v) return v;
  }
  return undefined;
}

function resolveUrl(url: string, baseHref: string): string {
  try {
    return new URL(url, baseHref).href;
  } catch {
    return url;
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw?.trim()) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw.trim());
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "invalid scheme" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(target.href, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ image: null });
    }

    const text = await res.text();
    const slice = text.slice(0, 600_000);
    const relative = findOgImage(slice);
    const image = relative ? resolveUrl(relative, res.url || target.href) : null;

    return NextResponse.json({ image });
  } catch {
    return NextResponse.json({ image: null });
  } finally {
    clearTimeout(timeout);
  }
}
