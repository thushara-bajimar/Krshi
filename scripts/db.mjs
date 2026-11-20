// Local development PostgreSQL using the `embedded-postgres` package (real PostgreSQL binaries).
// Use this only when you do not have PostgreSQL installed. In production point DATABASE_URL at a managed Postgres.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.env.PGDATA_DIR ?? ".pgdata");
const port = Number(process.env.PG_PORT ?? 5433);
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "krishi",
  password: "krishi",
  port,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
if (fresh) await pg.initialise();
await pg.start();
for (const db of ["krishi", "krishi_test"]) {
  try { await pg.createDatabase(db); } catch { /* already exists */ }
}
console.log(`PostgreSQL running on port ${port} (data: ${dataDir}). Press Ctrl+C to stop.`);
const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
