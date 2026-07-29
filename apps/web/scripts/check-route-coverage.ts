import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Automates the second recurring lesson from this migration's UI passes
 * (docs/web2-migration-design.md's "Overall Readiness Assessment"):
 * registerOfficer/registerPolicyApprover existed as fully-working,
 * correctly-authorized domain functions for two entire slices before
 * anyone noticed no API route ever exposed either one -- a UI pass caught
 * it by accident, not by design. This script makes that check mechanical:
 * every exported action/read function in lib/domain/*.ts must be imported
 * by at least one app/api/**\/route.ts file.
 *
 * Deliberately excluded from the "must have a route" requirement:
 * `requireActive*` (internal registry guards called by other domain
 * functions, never meant to be routed directly) and `validate*` (pure
 * validation helpers with no session/DB access, same reasoning).
 */

const DOMAIN_DIR = join(__dirname, "..", "lib", "domain");
const API_DIR = join(__dirname, "..", "app", "api");

const EXCLUDED_PREFIXES = ["requireActive", "validate"];

function listFiles(dir: string, predicate: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listFiles(full, predicate));
    else if (predicate(entry)) out.push(full);
  }
  return out;
}

function extractDomainExports(): Map<string, string> {
  const exported = new Map<string, string>(); // name -> source file
  const files = readdirSync(DOMAIN_DIR).filter((f) => f.endsWith(".ts"));
  const exportRegex = /export\s+(?:const|async function|function)\s+([a-zA-Z0-9_]+)/g;

  for (const file of files) {
    const content = readFileSync(join(DOMAIN_DIR, file), "utf-8");
    for (const match of content.matchAll(exportRegex)) {
      const name = match[1];
      if (EXCLUDED_PREFIXES.some((p) => name.startsWith(p))) continue;
      exported.set(name, file);
    }
  }
  return exported;
}

function extractRouteImports(): Set<string> {
  const imported = new Set<string>();
  const routeFiles = listFiles(API_DIR, (f) => f === "route.ts");
  // Matches `import { a, b } from "@/lib/domain/whatever";`
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*["']@\/lib\/domain\/[a-zA-Z0-9_-]+["']/g;

  for (const file of routeFiles) {
    const content = readFileSync(file, "utf-8");
    for (const match of content.matchAll(importRegex)) {
      for (const rawName of match[1].split(",")) {
        const name = rawName.trim().split(/\s+as\s+/)[0].trim();
        if (name) imported.add(name);
      }
    }
  }
  return imported;
}

function main() {
  const exported = extractDomainExports();
  const imported = extractRouteImports();

  const missing = [...exported.entries()].filter(([name]) => !imported.has(name));

  if (missing.length === 0) {
    console.log(`OK: all ${exported.size} routable exports in lib/domain/*.ts are imported by at least one app/api/**/route.ts file.`);
    process.exit(0);
  }

  console.error(`${missing.length} domain export(s) have no corresponding API route:\n`);
  for (const [name, file] of missing) {
    console.error(`  [FAIL] ${name} (lib/domain/${file}) -- never imported by any app/api/**/route.ts`);
  }
  process.exit(1);
}

main();
