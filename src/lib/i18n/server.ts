import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "../auth/session";
import { translate, type DictKey, type Lang } from "./dict";

export async function getLang(): Promise<Lang> {
  const user = await getCurrentUser();
  if (user) return user.language as Lang;
  const c = (await cookies()).get("lang")?.value;
  return c === "kn" ? "kn" : "en";
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: (k: DictKey) => translate(lang, k) };
}
