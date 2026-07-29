import type { DamlTemplate } from "./parseDaml";

// Applies the addendum A / addendum C lessons that had to be discovered by
// hand in Phase 1/2 as fixed rules, not conventions to remember per table:
// Decimal -> NUMERIC (never jsonb), every write policy is FOR INSERT/FOR
// UPDATE explicitly (never FOR ALL), FORCE ROW LEVEL SECURITY always set.

export interface RegistryCodegenConfig {
  tableName: string;
  /** Party-typed fields that are this registry's actual identity key (become a TEXT column), e.g. "assessor" on AuthorizedAssessor. Ambiguous by name alone -- see design doc's codegen findings. */
  identityPartyFields: string[];
  /** Party-typed fields that are fixed platform roles (dropped as columns; encoded via RLS role checks instead), e.g. "vetify", "financialInstitution". */
  frameworkPartyFields: string[];
  /** Roles with blanket SELECT visibility regardless of tenant, e.g. ["vetify"]. */
  blanketSelectRoles: string[];
  /** Roles allowed to write (INSERT/UPDATE) this table. */
  writeRoles: string[];
}

function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function damlTypeToSql(rawType: string): { sqlType: string; nullable: boolean } {
  const optionalMatch = rawType.match(/^Optional\s+(.+)$/);
  if (optionalMatch) {
    const inner = damlTypeToSql(optionalMatch[1]);
    return { sqlType: inner.sqlType, nullable: true };
  }
  if (rawType.startsWith("[")) return { sqlType: "JSONB", nullable: false };
  switch (rawType) {
    case "Text":
      return { sqlType: "TEXT", nullable: false };
    case "Int":
      return { sqlType: "INTEGER", nullable: false };
    case "Decimal":
      return { sqlType: "NUMERIC", nullable: false }; // addendum A
    case "Bool":
      return { sqlType: "BOOLEAN", nullable: false };
    case "Time":
      return { sqlType: "TIMESTAMPTZ", nullable: false };
    case "Date":
      return { sqlType: "DATE", nullable: false };
    default:
      // Unknown custom type (e.g. an enum like OfficerRole not itself
      // parsed as a Daml `data` declaration by this tool) -- fall back to
      // TEXT and flag it for manual review rather than guess further.
      return { sqlType: "TEXT" /* TODO: verify -- unrecognized Daml type */, nullable: false };
  }
}

export function generateTableSql(template: DamlTemplate, config: RegistryCodegenConfig): string {
  const lines: string[] = [];
  lines.push(`-- Generated from Daml template ${template.name} by scripts/codegen/genSql.ts.`);
  lines.push(`-- Review before applying -- see docs/web2-migration-design.md's codegen findings`);
  lines.push(`-- for what this tool cannot infer automatically (enum types, dynamic RLS role`);
  lines.push(`-- assignment for Party fields, cross-template FK relationships).`);
  lines.push(`CREATE TABLE ${config.tableName} (`);
  lines.push(`  id BIGSERIAL PRIMARY KEY,`);

  for (const field of template.fields) {
    if (config.frameworkPartyFields.includes(field.name)) continue; // encoded via RLS, not a column
    const columnName = toSnakeCase(field.name);
    if (field.type === "Party" && config.identityPartyFields.includes(field.name)) {
      lines.push(`  ${columnName} TEXT NOT NULL, -- Party (identity key, per codegen config)`);
      continue;
    }
    if (field.type === "Party") {
      lines.push(`  -- SKIPPED: ${field.name} (Party, not in identityPartyFields or frameworkPartyFields -- codegen config needs a decision here)`);
      continue;
    }
    const { sqlType, nullable } = damlTypeToSql(field.type);
    lines.push(`  ${columnName} ${sqlType}${nullable ? "" : " NOT NULL"}, -- ${field.type}`);
  }
  lines.push(`  archived_at TIMESTAMPTZ,`);
  lines.push(`  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),`);
  lines.push(`  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`);
  lines.push(`);`);
  lines.push("");

  if (template.ensureRaw) {
    lines.push(`-- Daml ensure clause (translate to CHECK constraints by hand -- not auto-translated):`);
    lines.push(`-- ensure ${template.ensureRaw}`);
    lines.push("");
  }

  lines.push(`ALTER TABLE ${config.tableName} ENABLE ROW LEVEL SECURITY;`);
  lines.push(`ALTER TABLE ${config.tableName} FORCE ROW LEVEL SECURITY;`);
  lines.push("");

  const blanket = config.blanketSelectRoles.map((r) => `'${r}'`).join(", ");
  const identityCols = config.identityPartyFields.map(toSnakeCase);
  let selectUsing = `current_setting('app.current_party_role', true) IN (${blanket})`;
  for (const col of identityCols) {
    selectUsing += `\n    OR (current_setting('app.current_party_role', true) = '${col}' AND ${col} = current_setting('app.current_party_id', true))`;
  }
  lines.push(`CREATE POLICY ${config.tableName}_select ON ${config.tableName}`);
  lines.push(`  FOR SELECT`);
  lines.push(`  USING (\n    ${selectUsing}\n  );`);
  lines.push("");

  const writeRoles = config.writeRoles.map((r) => `'${r}'`).join(", ");
  lines.push(`-- FOR INSERT / FOR UPDATE explicitly -- never FOR ALL (addendum C bug #2's lesson).`);
  lines.push(`CREATE POLICY ${config.tableName}_insert ON ${config.tableName}`);
  lines.push(`  FOR INSERT`);
  lines.push(`  WITH CHECK (current_setting('app.current_party_role', true) IN (${writeRoles}));`);
  lines.push("");
  lines.push(`CREATE POLICY ${config.tableName}_update ON ${config.tableName}`);
  lines.push(`  FOR UPDATE`);
  lines.push(`  USING (current_setting('app.current_party_role', true) IN (${writeRoles}))`);
  lines.push(`  WITH CHECK (current_setting('app.current_party_role', true) IN (${writeRoles}));`);
  lines.push("");

  lines.push(`CREATE TRIGGER trg_${config.tableName}_history`);
  lines.push(`  AFTER UPDATE ON ${config.tableName}`);
  lines.push(`  FOR EACH ROW EXECUTE FUNCTION record_entity_history();`);

  return lines.join("\n");
}
