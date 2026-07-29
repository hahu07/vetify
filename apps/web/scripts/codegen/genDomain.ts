import type { DamlAssert, DamlChoice, DamlHelperFunction, DamlTemplate } from "./parseDaml";
import { findHelperCalls } from "./parseDaml";

// Translates parsed Daml conditions/messages into JS -- deliberately a
// small, explicit rule set (not a general Daml/Haskell-to-JS transpiler).
// Anything outside these rules is passed through raw with a `/* TODO */`
// marker rather than guessed at, matching this project's "never fabricate"
// principle applied to codegen output itself.
//
// Three real bugs were found and fixed while building this against
// Governance.daml (see docs/web2-migration-design.md's codegen findings for
// the full account):
//   1. Bare Daml identifiers (`reason`, `active`) referred to the choice's
//      `with`-args or the template's own fields implicitly -- the first
//      version emitted them as bare JS identifiers with nothing in scope
//      binding them. Fixed by qualifying every recognized identifier to
//      `args.X` (choice arg) or `row.snake_case_x` (template field) before
//      any other translation runs.
//   2. `not active` (no parens) didn't match the `not\s+\(` rule and was
//      left as invalid JS. Fixed with a separate bare-identifier rule.
//   3. expandHelperCall stripped quotes from a literal string argument
//      (`"Officer"` -> `Officer`) before substituting it into a dynamic
//      message that gets `<>`-split later -- the unquoted text then failed
//      the string-literal regex in translateDynamicMessage and was
//      mistranslated as a variable reference. Fixed by never stripping the
//      quotes during substitution; only the final dynamic-message renderer
//      decides how to render a segment.

function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/** Qualifies bare Daml identifiers to `args.x` (a choice arg) or `row.snake_case_x` (a template field) so the emitted JS actually has these names in scope. */
function qualifyIdentifiers(raw: string, argNames: string[], fieldNames: string[]): string {
  let out = raw;
  for (const name of argNames) {
    out = out.replace(new RegExp(`\\b${name}\\b`, "g"), `args.${name}`);
  }
  for (const name of fieldNames) {
    out = out.replace(new RegExp(`\\b${name}\\b`, "g"), `row.${toSnakeCase(name)}`);
  }
  return out;
}

function translateCondition(raw: string): string {
  let js = raw.trim();
  js = js.replace(/\bnot\s+\(/g, "!(");
  // Bare-identifier form (`not active`, `not row.active`) -- doesn't match
  // the paren rule above (found live: this was silently left untranslated
  // as invalid JS on the first pass).
  js = js.replace(/\bnot\s+([a-zA-Z_][\w.]*)/g, "!$1");
  js = js.replace(/\/=/g, "!==");
  js = js.replace(/(?<![!<>=])==(?!=)/g, "===");
  if (/\bcase\b|\belem\b/.test(js)) {
    return `/* TODO: manual translation needed -- unsupported Daml construct */ true /* was: ${raw.replace(/\*\//g, "*-/")} */`;
  }
  return js;
}

/**
 * Splits on `<>` and qualifies identifiers PER SEGMENT, only for segments
 * that aren't quoted string literals -- qualifying the raw message as one
 * blind string first (the original approach) also matched plain English
 * words inside the literal portions (found live: "is already active"'s
 * "active" was rewritten to "is already row.active", since nothing
 * distinguished that "active" from the real field reference elsewhere in
 * the same message). Splitting first is what makes that distinction
 * possible without a real tokenizer.
 */
function translateDynamicMessage(raw: string, argNames: string[], fieldNames: string[]): string {
  const parts = raw.split("<>").map((p) => p.trim());
  const rendered = parts
    .map((p) => {
      const strMatch = p.match(/^"(.*)"$/);
      if (strMatch) return strMatch[1]; // literal text -- never qualified
      const qualified = qualifyIdentifiers(p, argNames, fieldNames);
      const partyToTextMatch = qualified.match(/^partyToText\s+(.+)$/);
      if (partyToTextMatch) return `\${${partyToTextMatch[1]}}`;
      return `\${${qualified}}`;
    })
    .join("");
  return "`" + rendered + "`";
}

function messageToJs(message: string, argNames: string[], fieldNames: string[]): string {
  if (message.startsWith("\0DYNAMIC:")) {
    return translateDynamicMessage(message.slice("\0DYNAMIC:".length), argNames, fieldNames);
  }
  return JSON.stringify(message);
}

/** Expands a call to a known helper function (e.g. requireCanDeactivate "Officer" active reason performedBy) into the helper's own asserts, with parameter names substituted for the call's actual argument expressions -- substitution is text-preserving (quotes kept as-is); qualifyIdentifiers/translateDynamicMessage decide how each resulting token renders, not this function. */
function expandHelperCall(
  call: { functionName: string; argsRaw: string[] },
  helpers: DamlHelperFunction[],
): DamlAssert[] {
  const helper = helpers.find((h) => h.name === call.functionName);
  if (!helper) return [];
  const substitution = new Map<string, string>();
  helper.paramNames.forEach((param, idx) => {
    const arg = call.argsRaw[idx];
    if (arg === undefined) return;
    substitution.set(param, arg);
  });
  const substitute = (text: string): string => {
    let out = text;
    for (const [param, value] of substitution) {
      out = out.replace(new RegExp(`\\b${param}\\b`, "g"), value);
    }
    return out;
  };
  return helper.asserts.map((a) => ({
    message: a.message.startsWith("\0DYNAMIC:") ? "\0DYNAMIC:" + substitute(a.message.slice(9)) : substitute(a.message),
    conditionRaw: substitute(a.conditionRaw),
  }));
}

export function generateChoiceFunction(
  templateName: string,
  fieldNames: string[],
  choice: DamlChoice,
  helpers: DamlHelperFunction[],
  roleMap: Record<string, string>,
): string {
  const fnName = choice.name.charAt(0).toLowerCase() + choice.name.slice(1);
  const controllerRoles = choice.controllers.map((c) => roleMap[c] ?? `/* TODO: map party '${c}' to a role */ "${c}"`);
  const argNames = choice.args.map((a) => a.name);

  const helperCalls = findHelperCalls(choice.bodyRaw, helpers.map((h) => h.name));
  const expandedAsserts = [...choice.asserts, ...helperCalls.flatMap((c) => expandHelperCall(c, helpers))];

  const lines: string[] = [];
  lines.push(`// Generated from ${templateName}.${choice.name} by scripts/codegen/genDomain.ts.`);
  lines.push(`// Review before use -- see docs/web2-migration-design.md's codegen findings.`);
  lines.push(`async function ${fnName}Impl(session: SessionContext, id: number, args: {`);
  for (const arg of choice.args) {
    lines.push(`  ${arg.name}: unknown; // Daml type: ${arg.type}`);
  }
  lines.push(`}) {`);
  lines.push(`  return withTransaction(session, async (client) => {`);
  lines.push(`    const { rows } = await client.query("SELECT * FROM ${toSnakeCase(templateName)} WHERE id = $1 FOR UPDATE", [id]);`);
  lines.push(`    const row = rows[0];`);
  lines.push(`    if (!row) throw new DomainError("${templateName} not found");`);
  for (const a of expandedAsserts) {
    const qualifiedCondition = qualifyIdentifiers(a.conditionRaw, argNames, fieldNames);
    const jsCondition = translateCondition(qualifiedCondition);
    const jsMessage = messageToJs(a.message, argNames, fieldNames);
    lines.push(`    if (!(${jsCondition})) throw new DomainError(${jsMessage});`);
  }
  if (choice.recreatesThis && choice.createFields.length > 0) {
    const setClauses = choice.createFields.map((f) => {
      const qualifiedValue = qualifyIdentifiers(f.valueRaw, argNames, fieldNames);
      return `${toSnakeCase(f.name)} = ${qualifiedValue} /* TODO: verify Optional/Some unwrap */`;
    });
    lines.push(`    // TODO: translate into an UPDATE (Some x -> x, verify types):`);
    lines.push(`    //   SET ${setClauses.join(", ")}`);
  }
  lines.push(`    return row;`);
  lines.push(`  });`);
  lines.push(`}`);
  lines.push(`export const ${fnName} = withAuthorization([${controllerRoles.map((r) => (r.startsWith('"') || r.startsWith("/*") ? r : `"${r}"`)).join(", ")}], ${fnName}Impl);`);
  return lines.join("\n");
}

export function generateDomainFile(template: DamlTemplate, helpers: DamlHelperFunction[], roleMap: Record<string, string>): string {
  const header = [
    `import type { SessionContext } from "@/lib/db";`,
    `import { withTransaction } from "@/lib/db";`,
    `import { withAuthorization } from "@/lib/auth/withAuthorization";`,
    `import { DomainError } from "@/lib/errors";`,
    ``,
    `// Generated from Daml template ${template.name} (daml/Vetify/Governance.daml)`,
    `// by scripts/codegen/genDomain.ts -- this is codegen OUTPUT, not hand-written.`,
    `// See docs/web2-migration-design.md's codegen findings for what needed manual`,
    `// correction before this compiled and passed its tests.`,
    ``,
  ].join("\n");
  const fieldNames = template.fields.map((f) => f.name);
  const choiceFns = template.choices
    .map((c) => generateChoiceFunction(template.name, fieldNames, c, helpers, roleMap))
    .join("\n\n");
  return header + choiceFns + "\n";
}
