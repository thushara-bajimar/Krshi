import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validation/schemas";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { clientIp, errorResponse, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const rl = rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: "Too many sign-up attempts. Try again later." }, { status: 429 });
    const data = registerSchema.parse(await readJson(req));
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return NextResponse.json({ error: "An account with this email already exists", fieldErrors: { email: ["Already registered — try signing in"] } }, { status: 409 });
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, phone: data.phone, district: data.district, language: data.language, passwordHash: await hashPassword(data.password), settings: { create: { voiceLanguage: data.language === "kn" ? "kn-IN" : "en-IN" } } },
    });
    await createSession(user.id);
    const res = NextResponse.json({ ok: true }, { status: 201 });
    res.cookies.set("lang", data.language, { path: "/", maxAge: 31536000, sameSite: "lax" });
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
