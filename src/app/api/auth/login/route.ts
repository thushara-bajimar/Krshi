import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation/schemas";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { clientIp, errorResponse, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

// Constant-time-ish failure path: compare against a dummy hash when the user does not exist.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5nQmJ8jvOyqDqGJ2NZv8ZJq9xL2pW6e";

export async function POST(req: Request) {
  try {
    const data = loginSchema.parse(await readJson(req));
    const rl = rateLimit(`login:${clientIp(req)}:${data.email}`, 8, 15 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} minutes.` }, { status: 429 });
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    const ok = await verifyPassword(data.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) return NextResponse.json({ error: "Email or password is incorrect" }, { status: 401 });
    await createSession(user.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set("lang", user.language, { path: "/", maxAge: 31536000, sameSite: "lax" });
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
