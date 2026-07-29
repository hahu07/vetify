import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "username and password are required" }, { status: 400 });
  }

  const { rows } = await pool.query(
    "SELECT * FROM users WHERE username = $1 AND active = true",
    [username],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = signSession({
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    partyRole: user.party_role,
    cacRegNumber: user.cac_reg_number,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });

  return NextResponse.json({
    username: user.username,
    displayName: user.display_name,
    partyRole: user.party_role,
    cacRegNumber: user.cac_reg_number,
  });
}
