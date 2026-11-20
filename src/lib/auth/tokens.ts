import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "krishi_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const newSessionToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
