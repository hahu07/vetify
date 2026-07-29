// A line-scanning parser for this codebase's Daml templates -- NOT a full
// Daml/Haskell grammar. It relies on the consistent 2-space-indent style
// used throughout daml/Vetify/*.daml (verified by hand across Onboarding,
// Compliance, Financing, Murabahah, Governance before writing this). This
// is the experiment testing whether Phase 1/2's hand-authored translation
// pattern generalizes into codegen -- see docs/web2-migration-design.md's
// "Codegen Experiment" section for the actual findings.

export interface DamlField {
  name: string;
  type: string; // raw Daml type text, e.g. "Text", "Optional Decimal", "[OfficerRole]", "Party"
}

export interface DamlAssert {
  message: string;
  conditionRaw: string;
}

export interface DamlCreateField {
  name: string;
  valueRaw: string;
}

export interface DamlChoice {
  name: string;
  nonconsuming: boolean;
  returnType: string;
  args: DamlField[];
  controllers: string[];
  asserts: DamlAssert[];
  /** true if the choice body does `create this with ...` (same-template recreate) */
  recreatesThis: boolean;
  /** the target template name if the body does `create Foo with ...` for some other Foo */
  createsTemplate?: string;
  createFields: DamlCreateField[];
  bodyRaw: string;
}

export interface DamlTemplate {
  name: string;
  fields: DamlField[];
  signatories: string[];
  observers: string[];
  ensureRaw?: string;
  choices: DamlChoice[];
}

/**
 * A top-level `name : Type -> Type -> ... -> Update ()` function whose
 * body is a sequence of `assertMsg` calls -- this codebase's shared-
 * validation-helper pattern (`requireCanDeactivate`, `requireCanReactivate`,
 * the five `requireActive*` registry gates). A template-scoped choice
 * parser can't see into these on its own: a choice body calling
 * `requireCanDeactivate "Officer" active reason performedBy` has zero
 * literal `assertMsg` text for the choice parser to find (confirmed live
 * against Governance.daml -- every Deactivate-or-Reactivate choice parsed
 * with `asserts: []` until this was added). Parsed separately, then
 * cross-referenced by call name when generating a choice's TypeScript body.
 */
export interface DamlHelperFunction {
  name: string;
  paramNames: string[];
  asserts: DamlAssert[];
}

/** A detected call to a known helper function inside a choice body, e.g. `requireCanDeactivate "Officer" active reason performedBy`. */
export interface DamlHelperCall {
  functionName: string;
  argsRaw: string[];
}

export function parseDamlHelperFunctions(source: string): DamlHelperFunction[] {
  const lines = source.split("\n");
  const helpers: DamlHelperFunction[] = [];

  for (let i = 0; i < lines.length; i++) {
    const sigMatch = stripComment(lines[i]).match(/^(\w+)\s*:\s*(?:.+->\s*)*Update\s+\(\)\s*$/);
    if (!sigMatch) continue;
    const fnName = sigMatch[1];
    // Next non-blank line should be the implementation: "name arg1 arg2 = do"
    let j = i + 1;
    while (j < lines.length && stripComment(lines[j]).trim() === "") j++;
    const implMatch = stripComment(lines[j]).match(new RegExp(`^${fnName}\\s+([\\w\\s]+?)\\s*=\\s*do\\s*$`));
    if (!implMatch) continue;
    const paramNames = implMatch[1].trim().split(/\s+/);
    j++;
    const bodyIndent = j < lines.length ? indentOf(lines[j]) : 0;
    const bodyLines: string[] = [];
    while (j < lines.length) {
      const bl = stripComment(lines[j]);
      if (bl.trim() === "") {
        j++;
        continue;
      }
      if (indentOf(lines[j]) < bodyIndent) break;
      bodyLines.push(bl);
      j++;
    }
    const bodyRaw = bodyLines.join("\n");
    const asserts = extractAsserts(bodyRaw);
    helpers.push({ name: fnName, paramNames, asserts });
  }
  return helpers;
}

/** Finds calls to any of `knownNames` within `bodyRaw`, e.g. detects `requireCanDeactivate "Officer" active reason performedBy`. */
export function findHelperCalls(bodyRaw: string, knownNames: string[]): DamlHelperCall[] {
  const calls: DamlHelperCall[] = [];
  for (const line of bodyRaw.split("\n")) {
    const trimmed = line.trim();
    for (const name of knownNames) {
      if (trimmed.startsWith(name + " ")) {
        const rest = trimmed.slice(name.length).trim();
        // Best-effort tokenizer: a quoted string counts as one arg, else
        // whitespace-separated identifiers count as one arg each.
        const argsRaw: string[] = [];
        const re = /"(?:[^"\\]|\\.)*"|\S+/g;
        let am: RegExpExecArray | null;
        while ((am = re.exec(rest))) argsRaw.push(am[0]);
        calls.push({ functionName: name, argsRaw });
      }
    }
  }
  return calls;
}

function stripComment(line: string): string {
  const idx = line.indexOf("--");
  return idx === -1 ? line : line.slice(0, idx);
}

function indentOf(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/** Splits a comma-separated party list, e.g. "verifier, vetify" -> ["verifier", "vetify"]. */
function splitParties(raw: string): string[] {
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function parseDamlTemplates(source: string): DamlTemplate[] {
  const rawLines = source.split("\n");
  const templates: DamlTemplate[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const templateMatch = stripComment(line).match(/^template\s+(\w+)\s*$/);
    if (!templateMatch) {
      i++;
      continue;
    }
    const name = templateMatch[1];
    i++;

    const fields: DamlField[] = [];
    const signatories: string[] = [];
    const observers: string[] = [];
    let ensureRaw: string | undefined;
    const choices: DamlChoice[] = [];

    // Expect "  with" next (fields block)
    while (i < rawLines.length && stripComment(rawLines[i]).trim() === "") i++;
    if (stripComment(rawLines[i]).trim() === "with") {
      i++;
      while (i < rawLines.length) {
        const l = stripComment(rawLines[i]);
        if (l.trim() === "") {
          i++;
          continue;
        }
        if (l.trim() === "where") break;
        const fieldMatch = l.match(/^\s+(\w+)\s*:\s*(.+?)\s*$/);
        if (fieldMatch) {
          fields.push({ name: fieldMatch[1], type: fieldMatch[2] });
          i++;
          continue;
        }
        // Unrecognized line inside the with-block (e.g. a multi-line type
        // continuation) -- skip it rather than mis-parse.
        i++;
      }
    }

    // "where" block: signatory/observer/ensure/choices
    if (stripComment(rawLines[i]).trim() === "where") i++;

    while (i < rawLines.length) {
      const l = stripComment(rawLines[i]);
      const trimmed = l.trim();

      if (trimmed === "") {
        i++;
        continue;
      }
      // Stop this template's where-block once we hit the next top-level
      // template/function definition (indent 0, not a comment/blank).
      if (indentOf(rawLines[i]) === 0 && rawLines[i].trim() !== "") break;

      const sigMatch = trimmed.match(/^signatory\s+(.+)$/);
      if (sigMatch) {
        signatories.push(...splitParties(sigMatch[1]));
        i++;
        continue;
      }
      const obsMatch = trimmed.match(/^observer\s+(.+)$/);
      if (obsMatch) {
        observers.push(...splitParties(obsMatch[1]));
        i++;
        continue;
      }
      const ensureMatch = trimmed.match(/^ensure\s*(.*)$/);
      if (ensureMatch) {
        const ensureIndent = indentOf(rawLines[i]);
        const parts = [ensureMatch[1]].filter(Boolean);
        i++;
        while (i < rawLines.length) {
          const nl = stripComment(rawLines[i]);
          if (nl.trim() === "") {
            i++;
            continue;
          }
          if (indentOf(rawLines[i]) <= ensureIndent) break;
          if (/^\s*(nonconsuming\s+)?choice\s/.test(nl)) break;
          parts.push(nl.trim());
          i++;
        }
        ensureRaw = parts.join(" ").trim();
        continue;
      }

      const choiceMatch = trimmed.match(/^(nonconsuming\s+)?choice\s+(\w+)\s*:\s*(.+)$/);
      if (choiceMatch) {
        const nonconsuming = !!choiceMatch[1];
        const choiceName = choiceMatch[2];
        const returnType = choiceMatch[3].trim();
        i++;

        const args: DamlField[] = [];
        // Optional "with" args block
        while (i < rawLines.length && stripComment(rawLines[i]).trim() === "") i++;
        if (stripComment(rawLines[i]).trim() === "with") {
          i++;
          while (i < rawLines.length) {
            const al = stripComment(rawLines[i]);
            if (al.trim() === "") {
              i++;
              continue;
            }
            const argMatch = al.match(/^\s+(\w+)\s*:\s*(.+?)\s*$/);
            if (argMatch && !/^controller\b/.test(al.trim())) {
              args.push({ name: argMatch[1], type: argMatch[2] });
              i++;
              continue;
            }
            break;
          }
        }

        // controller line
        let controllers: string[] = [];
        while (i < rawLines.length && stripComment(rawLines[i]).trim() === "") i++;
        const controllerMatch = stripComment(rawLines[i]).trim().match(/^controller\s+(.+)$/);
        if (controllerMatch) {
          controllers = splitParties(controllerMatch[1]);
          i++;
        }

        // "do" body
        while (i < rawLines.length && stripComment(rawLines[i]).trim() === "") i++;
        const bodyLines: string[] = [];
        if (stripComment(rawLines[i]).trim() === "do") {
          const doIndent = indentOf(rawLines[i]);
          i++;
          while (i < rawLines.length) {
            const bl = stripComment(rawLines[i]);
            if (bl.trim() === "") {
              bodyLines.push("");
              i++;
              continue;
            }
            if (indentOf(rawLines[i]) <= doIndent) break;
            bodyLines.push(bl);
            i++;
          }
        }
        const bodyRaw = bodyLines.join("\n");
        const asserts = extractAsserts(bodyRaw);

        // Detect create this / create <Template>
        let recreatesThis = false;
        let createsTemplate: string | undefined;
        const createFields: DamlCreateField[] = [];
        // [ \t]*\n (not \s*\n?) -- \s* would also greedily eat the first
        // field line's own leading indentation (since \s matches newlines
        // too), throwing off extractCreateFields's block-indent detection
        // for every field after the first (found live: only the first
        // create-field was ever captured until this fix).
        const createThisMatch = bodyRaw.match(/create\s+this\s+with[ \t]*\n([\s\S]*)/);
        const createOtherMatch = bodyRaw.match(/create\s+(\w+)\s+with[ \t]*\n([\s\S]*)/);
        if (createThisMatch) {
          recreatesThis = true;
          extractCreateFields(createThisMatch[1], createFields);
        } else if (createOtherMatch) {
          createsTemplate = createOtherMatch[1];
          extractCreateFields(createOtherMatch[2], createFields);
        }

        choices.push({
          name: choiceName,
          nonconsuming,
          returnType,
          args,
          controllers,
          asserts,
          recreatesThis,
          createsTemplate,
          createFields,
          bodyRaw,
        });
        continue;
      }

      // Unrecognized where-block line (helper `let`, `case`, etc. outside a
      // choice) -- skip.
      i++;
    }

    templates.push({ name, fields, signatories, observers, ensureRaw, choices });
  }

  return templates;
}

/**
 * Extracts every `assertMsg <message> <condition>` call from a Daml
 * function/choice body. `<message>` comes in two shapes in this codebase,
 * both common (~20 dynamic-message call sites found across daml/Vetify/*.daml
 * when this was added -- the first version of this parser only handled the
 * literal-string shape and silently dropped every dynamic one):
 *   1. A literal string: `assertMsg "Reason must not be empty" (...)`
 *   2. A parenthesized expression, usually string concatenation embedding an
 *      identifier for a more specific runtime message:
 *      `assertMsg (entityLabel <> " is already inactive") active`
 * Shape 2's `messageRaw` is kept as raw Daml expression text (e.g.
 * `entityLabel <> " is already inactive"`) for the generator to
 * best-effort-translate (`<>` -> `+`, `partyToText x` -> `x`) rather than
 * evaluated here.
 */
function extractAsserts(bodyRaw: string): DamlAssert[] {
  const asserts: DamlAssert[] = [];
  const callRegex = /assertMsg\s+/g;
  let m: RegExpExecArray | null;
  while ((m = callRegex.exec(bodyRaw))) {
    const afterKeyword = bodyRaw.slice(callRegex.lastIndex);
    const literalMatch = afterKeyword.match(/^"((?:[^"\\]|\\.)*)"\s*/);
    if (literalMatch) {
      const condition = extractBalancedOrRestOfLine(afterKeyword.slice(literalMatch[0].length));
      asserts.push({ message: literalMatch[1], conditionRaw: condition.trim() });
      continue;
    }
    if (afterKeyword.startsWith("(")) {
      // Dynamic message: find the matching close-paren for the message
      // expression, then the condition follows.
      let depth = 0;
      let closeIdx = -1;
      for (let idx = 0; idx < afterKeyword.length; idx++) {
        if (afterKeyword[idx] === "(") depth++;
        else if (afterKeyword[idx] === ")") {
          depth--;
          if (depth === 0) {
            closeIdx = idx;
            break;
          }
        }
      }
      if (closeIdx === -1) continue; // unbalanced -- give up on this call
      const messageRaw = afterKeyword.slice(1, closeIdx);
      const condition = extractBalancedOrRestOfLine(afterKeyword.slice(closeIdx + 1));
      asserts.push({ message: `\0DYNAMIC:${messageRaw.trim()}`, conditionRaw: condition.trim() });
    }
  }
  return asserts;
}

/** Given text starting right after `assertMsg "msg"`, returns the parenthesized condition (balanced) or the rest of the first line if unparenthesized. */
function extractBalancedOrRestOfLine(text: string): string {
  const trimmed = text.replace(/^\s+/, "");
  if (!trimmed.startsWith("(")) {
    return trimmed.split("\n")[0];
  }
  let depth = 0;
  for (let idx = 0; idx < trimmed.length; idx++) {
    if (trimmed[idx] === "(") depth++;
    else if (trimmed[idx] === ")") {
      depth--;
      if (depth === 0) return trimmed.slice(1, idx);
    }
  }
  return trimmed.split("\n")[0];
}

/** Parses `field = expr` / `field;` / bare `field` lines inside a create-with block, stopping at the first line that de-indents past the block or looks like a new statement. */
function extractCreateFields(text: string, out: DamlCreateField[]): void {
  const lines = text.split("\n");
  let blockIndent: number | null = null;
  for (const raw of lines) {
    if (raw.trim() === "") continue;
    const indent = indentOf(raw);
    if (blockIndent === null) blockIndent = indent;
    if (indent < blockIndent) break;
    if (indent > blockIndent) continue; // nested continuation of previous value, skip for this best-effort parser
    const trimmed = raw.trim().replace(/;$/, "");
    if (!trimmed) continue;
    // Stop if this doesn't look like a field assignment/pun anymore.
    if (/^(return|pure|case|if|let)\b/.test(trimmed)) break;
    const eqMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (eqMatch) {
      out.push({ name: eqMatch[1], valueRaw: eqMatch[2] });
      continue;
    }
    // Semicolon-punned shorthand: "business; vetify; verifier" on one line,
    // or a single bare identifier meaning field = field.
    const punMatches = trimmed.match(/^\w+$/);
    if (punMatches) {
      out.push({ name: trimmed, valueRaw: trimmed });
    }
  }
}
