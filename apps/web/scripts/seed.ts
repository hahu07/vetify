import bcrypt from "bcryptjs";
import { Client } from "pg";
import "dotenv/config";

async function main() {
  const client = new Client({
    host: process.env.WEB_POSTGRES_HOST ?? "localhost",
    port: Number(process.env.WEB_POSTGRES_PORT ?? 5434),
    user: process.env.WEB_POSTGRES_USER ?? "vetify_web",
    password: process.env.WEB_POSTGRES_PASSWORD ?? "vetify_web",
    database: process.env.WEB_POSTGRES_DATABASE ?? "vetify_web",
  });
  await client.connect();

  const demoUsers = [
    { username: "business1", password: "password123", displayName: "Adaeze Textiles Ltd", partyRole: "business", cacRegNumber: "RC1234567" },
    { username: "verifier1", password: "password123", displayName: "Chidinma Okeke (Verifier)", partyRole: "verifier", cacRegNumber: null },
    { username: "vetify1", password: "password123", displayName: "Vetify Ops", partyRole: "vetify", cacRegNumber: null },
    { username: "assessor1", password: "password123", displayName: "Tunde Bakare (Assessor)", partyRole: "assessor", cacRegNumber: null },
    { username: "fi1", password: "password123", displayName: "First Halal Bank", partyRole: "financialInstitution", cacRegNumber: null },
    { username: "advisor1", password: "password123", displayName: "Sheikh Ibrahim Yusuf (SSB)", partyRole: "advisor", cacRegNumber: null },
    { username: "sentinel1", password: "password123", displayName: "Amara Nwosu (Sentinel)", partyRole: "sentinel", cacRegNumber: null },
    { username: "regulator1", password: "password123", displayName: "CBN NIFI Supervision Desk", partyRole: "regulator", cacRegNumber: null },
  ];

  for (const u of demoUsers) {
    const hash = await bcrypt.hash(u.password, 10);
    await client.query(
      `INSERT INTO users (username, password_hash, display_name, party_role, cac_reg_number)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [u.username, hash, u.displayName, u.partyRole, u.cacRegNumber],
    );
    console.log(`seeded ${u.username} (${u.partyRole})`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
