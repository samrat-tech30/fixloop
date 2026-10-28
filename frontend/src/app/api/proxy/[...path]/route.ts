// Server-side proxy: browser -> /api/proxy/<path> -> BACKEND_URL/<path> with X-API-Key.
// Keeps the backend key and URL off the client and limits what the browser can reach.
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
const API_KEY = process.env.APP_API_KEY ?? "";
const ALLOWED_PREFIXES = ["analyze", "feedback", "stats", "patterns", "samples", "demo", "agent", "runs", "patches", "health"];
const MAX_BODY_BYTES = 256_000;
const SEGMENT = /^[A-Za-z0-9._-]+$/;

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(req: NextRequest, ctx: Ctx, method: "GET" | "POST") {
  const { path } = await ctx.params;
  if (!path?.length || !ALLOWED_PREFIXES.includes(path[0]) || !path.every((s) => SEGMENT.test(s))) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }

  let body: string | undefined;
  if (method === "POST") {
    body = await req.text();
    if (body.length > MAX_BODY_BYTES) {
      return NextResponse.json({ detail: "Request too large" }, { status: 413 });
    }
  }

  const url = `${BACKEND_URL}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  try {
    const res = await fetch(url, {
      method,
      body,
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
        "X-Forwarded-For": req.headers.get("x-forwarded-for") ?? "",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ detail: "Backend is not reachable" }, { status: 502 });
  }
}

export function GET(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx, "GET");
}

export function POST(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx, "POST");
}
