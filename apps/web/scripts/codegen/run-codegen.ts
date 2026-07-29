import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { parseDamlTemplates, parseDamlHelperFunctions } from "./parseDaml";
import { generateTableSql, type RegistryCodegenConfig } from "./genSql";
import { generateDomainFile } from "./genDomain";

// Configuration this codegen tool needs a human to supply per template --
// see docs/web2-migration-design.md's codegen findings for why these can't
// all be inferred from the Daml source alone (a Party-typed field could be
// either a fixed framework role or this registry's actual identity key;
// nothing in the syntax distinguishes them).
const CONFIGS: Record<string, RegistryCodegenConfig> = {
  AuthorizedOfficer: {
    tableName: "authorized_officer",
    identityPartyFields: [],
    frameworkPartyFields: ["financialInstitution", "vetify"],
    blanketSelectRoles: ["vetify", "financialInstitution"],
    writeRoles: ["financialInstitution"],
  },
  PolicyApprover: {
    tableName: "policy_approver",
    identityPartyFields: [],
    frameworkPartyFields: ["vetify"],
    blanketSelectRoles: ["vetify"],
    writeRoles: ["vetify"],
  },
  AuthorizedAssessor: {
    tableName: "authorized_assessor",
    identityPartyFields: ["assessor"],
    frameworkPartyFields: ["vetify"],
    blanketSelectRoles: ["vetify"],
    writeRoles: ["vetify"],
  },
  AuthorizedSentinel: {
    tableName: "authorized_sentinel",
    identityPartyFields: ["sentinel"],
    frameworkPartyFields: ["vetify"],
    blanketSelectRoles: ["vetify"],
    writeRoles: ["vetify"],
  },
  AuthorizedAdvisor: {
    tableName: "authorized_advisor",
    identityPartyFields: ["advisor"],
    frameworkPartyFields: ["vetify"],
    blanketSelectRoles: ["vetify"],
    writeRoles: ["vetify"],
  },
};

const ROLE_MAP: Record<string, string> = {
  vetify: "vetify",
  financialInstitution: "financialInstitution",
  business: "business",
  verifier: "verifier",
  assessor: "assessor",
  sentinel: "sentinel",
  advisor: "advisor",
};

const damlPath = process.argv[2];
const outDir = process.argv[3];
if (!damlPath || !outDir) {
  console.error("usage: run-codegen.ts <path-to.daml> <output-dir>");
  process.exit(1);
}

const source = readFileSync(damlPath, "utf8");
const templates = parseDamlTemplates(source);
const helpers = parseDamlHelperFunctions(source);

mkdirSync(outDir, { recursive: true });

let sqlAll = "";
let domainAll = "";
for (const template of templates) {
  const config = CONFIGS[template.name];
  if (!config) {
    console.log(`skip ${template.name} (no codegen config supplied)`);
    continue;
  }
  const sql = generateTableSql(template, config);
  const domain = generateDomainFile(template, helpers, ROLE_MAP);
  sqlAll += sql + "\n\n";
  domainAll += domain + "\n";
  console.log(`generated ${template.name} -> ${config.tableName} (${template.choices.length} choices)`);
}

writeFileSync(path.join(outDir, "generated_schema.sql"), sqlAll);
writeFileSync(path.join(outDir, "generated_domain.ts"), domainAll);
console.log(`wrote ${outDir}/generated_schema.sql and generated_domain.ts`);
