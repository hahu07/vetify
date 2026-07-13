/**
 * Dev-convenience seed script for Layer 3's human user accounts.
 * Run once against a fresh app database: `npx tsx src/scripts/seedUsers.ts`
 *
 * Passwords are printed to stdout on first run only — there is no recovery
 * flow in this dev-only implementation, so note them down.
 */
import "dotenv/config";
import { hashPassword } from "../auth.js";
import { pool } from "../appdb.js";

interface SeedUser {
  username: string;
  password: string;
  displayName: string;
  partyRole: string;
}

// Matches the PolicyApprover/riskCommittee names already used elsewhere in
// this session (docs/risk-governance-charter.md §3).
const SEED_USERS: SeedUser[] = [
  { username: "bob.adeyemi", password: "changeme123", displayName: "Bob Adeyemi", partyRole: "vetify" },
  { username: "yusuf.ibrahim", password: "changeme123", displayName: "Yusuf Ibrahim", partyRole: "vetify" },
  { username: "imam.yusuf", password: "changeme123", displayName: "Imam Yusuf Abdullahi", partyRole: "riskCommittee" },
  // Portal demo accounts (review gap G1): the frontend's login page is no
  // longer a mock with credentials baked into the bundle — these accounts
  // back the demo credentials it displays. partyRole maps 1:1 to the portal
  // roles and to the backend's per-route requireAuth gates
  // (business/financer/vetify/riskCommittee). Dev-only passwords, same
  // caveat as the rest of this script.
  { username: "business@vetify.ng", password: "password123", displayName: "Adekunle Bello", partyRole: "business" },
  { username: "fi@vetify.ng", password: "password123", displayName: "Fatima Musa", partyRole: "financer" },
  { username: "admin@vetify.ng", password: "password123", displayName: "Yusuf Ibrahim", partyRole: "vetify" },
  { username: "risk@vetify.ng", password: "password123", displayName: "Imam Yusuf Abdullahi", partyRole: "riskCommittee" },
];

async function main() {
  for (const u of SEED_USERS) {
    const passwordHash = await hashPassword(u.password);
    await pool.query(
      `INSERT INTO users (username, password_hash, display_name, party_role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [u.username, passwordHash, u.displayName, u.partyRole],
    );
    console.log(`Seeded ${u.username} (${u.displayName}, ${u.partyRole}) — password: ${u.password}`);
  }
  await pool.end();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
