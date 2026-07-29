import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <h1 className="font-display text-2xl font-semibold text-gray-900 mb-2">Vetify Web — Phase 1 vertical slice</h1>
        <p className="text-sm text-gray-500 mb-6">
          Postgres + Next.js proof of concept for Stage 1-4 (Onboarding → Verification → Compliance Review →
          Approved Business). See <code className="text-xs">docs/web2-migration-design.md</code> in the main repo.
        </p>
        <div className="card p-5 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Demo accounts (seeded via <code className="text-xs">npm run seed</code>):
          </p>
          <ul className="text-sm text-gray-600 space-y-1 font-mono">
            <li>business1 / password123</li>
            <li>verifier1 / password123</li>
            <li>vetify1 / password123</li>
          </ul>
        </div>
        <Link href="/login" className="btn-primary inline-flex">Log in →</Link>
      </div>
    </main>
  );
}
