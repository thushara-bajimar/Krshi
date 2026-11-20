import { execSync } from "node:child_process";

// Applies migrations to the dedicated TEST database before integration tests. Never points at the dev database.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://krishi:krishi@localhost:5433/krishi_test?schema=public";
  if (!/test/.test(url)) throw new Error("TEST_DATABASE_URL must point at a database whose name contains 'test'");
  if (process.argv.some((a) => a.includes("tests/unit"))) return; // unit-only runs need no database
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
