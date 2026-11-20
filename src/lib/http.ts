import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { HttpError, unauthorized } from "./errors";
import { getCurrentUser, type CurrentUser } from "./auth/session";
import { rateLimit } from "./rate-limit";
import { serialize } from "./serialize";

type Ctx<P> = { params: Promise<P> };

export function json(data: unknown, status = 200) {
  return NextResponse.json(serialize(data), { status });
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "Please check the highlighted fields", fieldErrors: err.flatten().fieldErrors }, { status: 400 });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return NextResponse.json({ error: "A record with these details already exists" }, { status: 409 });
    if (err.code === "P2025") return NextResponse.json({ error: "Record not found" }, { status: 404 });
    if (err.code === "P2003") return NextResponse.json({ error: "A linked record does not exist or is still in use" }, { status: 400 });
  }
  if (err instanceof Error && err.message && !(err instanceof Prisma.PrismaClientUnknownRequestError)) {
    // domain errors thrown by calculators etc. are safe to show
    if (err.name === "Error" && err.message.length < 200) {
      console.error("[api]", err.message);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }
  console.error("[api] unexpected error", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** Wraps an authenticated route handler with error handling and per-user rate limiting. */
export function authed<P = Record<string, string>>(
  fn: (req: Request, user: CurrentUser, params: P) => Promise<Response>,
  opts: { limit?: number; windowMs?: number } = {},
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const user = await getCurrentUser();
      if (!user) throw unauthorized();
      if (req.method !== "GET") {
        const rl = rateLimit(`w:${user.id}`, opts.limit ?? 120, opts.windowMs ?? 60_000);
        if (!rl.ok) return NextResponse.json({ error: "Too many requests, please slow down" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
      }
      return await fn(req, user, (await ctx.params) ?? ({} as P));
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "local";
}
