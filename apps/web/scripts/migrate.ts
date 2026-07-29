import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import "dotenv/config";

const MIGRATIONS_DIR = path.join(import.meta.dirname, "..", "migrations");

async function main() {
  const client = new Client({
    host: process.env.WEB_POSTGRES_HOST ?? "localhost",
    port: Number(process.env.WEB_POSTGRES_PORT ?? 5434),
    user: process.env.WEB_POSTGRES_USER ?? "vetify_web",
    password: process.env.WEB_POSTGRES_PASSWORD ?? "vetify_web",
    database: process.env.WEB_POSTGRES_DATABASE ?? "vetify_web",
  });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await client.query("SELECT filename FROM schema_migrations")).rows.map(
      (r) => r.filename,
    ),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    console.log(`apply ${file}`);
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }

  await client.end();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
