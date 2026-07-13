/**
 * Deterministic Shariah sector/structure classification — item 4 of the
 * off-ledger determinism work. Ports the maintained tables in
 * agents/skills/shariah/references/prohibited-sectors.md into a keyword
 * lookup, replacing the LLM as the verdict authority. Classifying a sector
 * or financing structure by keyword match against a fixed, human-maintained
 * table is genuinely deterministic (same input, same output) in a way that
 * "ask an LLM to interpret AAOIFI passages" is not.
 *
 * Fails closed: any sector not found in the table returns REQUIRES_REVIEW,
 * never COMPLIANT or NON_COMPLIANT by default. The RAG/LLM pipeline in
 * shariah.ts is only ever consulted for a narrative explanation on that
 * REQUIRES_REVIEW path — it never gets to override a table verdict.
 */

export type ShariahVerdict = "COMPLIANT" | "REQUIRES_REVIEW" | "NON_COMPLIANT";

export interface ShariahClassification {
  verdict: ShariahVerdict;
  citation: string;
  /** The table keyword that matched, if any — omitted on the fail-closed default. */
  matchedKeyword?: string;
}

interface KeywordRule {
  keywords: string[];
  citation: string;
}

// ─── Prohibited financing structures (checked against financingPurpose) ─────
// AAOIFI Shari'a Standard No. 8 (Murabahah) and No. 28 (Prohibited Activities).
const PROHIBITED_STRUCTURES: KeywordRule[] = [
  { keywords: ["refinanc"], citation: "AAOIFI Shari'a Standard No. 8, Clause 3/1 — refinancing existing conventional debt creates disguised riba" },
  { keywords: ["working capital"], citation: "AAOIFI Shari'a Standard No. 8, Clause 2/1 — Murabahah requires a real, identified asset, not undifferentiated working capital" },
  { keywords: ["cash advance"], citation: "AAOIFI Shari'a Standard No. 8, Clause 2/3 — cash cannot be the subject of a Murabahah sale" },
  { keywords: ["speculative commodity", "commodity speculat"], citation: "AAOIFI Shari'a Standard No. 28, Clause 4/3 — speculative commodity trading (maysir)" },
  { keywords: ["forward currency", "fx speculat", "currency speculat"], citation: "AAOIFI Shari'a Standard No. 28, Clause 4/3 — forward currency speculation (gharar)" },
];

// ─── Prohibited sectors — hard reject, no exception ─────────────────────────
const PROHIBITED_SECTORS: KeywordRule[] = [
  { keywords: ["alcohol", "brewery", "liquor", "wine", "beer"], citation: "AAOIFI Shari'a Standard No. 28 — alcohol production, distribution, wholesale, or retail" },
  { keywords: ["gambling", "casino", "betting", "lottery", "wager"], citation: "AAOIFI Shari'a Standard No. 28 — gambling & betting (casinos, sports betting, lottery, online gambling)" },
  { keywords: ["tobacco", "cigarette", "vaping", "vape"], citation: "AAOIFI Shari'a Standard No. 28 — tobacco manufacturing, distribution, or vaping products" },
  { keywords: ["pork", "swine", "pig farming", "non-halal meat", "non halal meat"], citation: "AAOIFI Shari'a Standard No. 28 — pork or non-halal meat production" },
  { keywords: ["adult entertainment", "pornograph", "escort service", "strip club"], citation: "AAOIFI Shari'a Standard No. 28 — adult entertainment" },
  { keywords: ["conventional bank", "money lend", "interest lend", "riba"], citation: "AAOIFI Shari'a Standard No. 28; CBN NIFI Framework — conventional interest-based lending (riba)" },
  { keywords: ["weapon", "arms trad", "arms manufactur", "military equipment", "firearms"], citation: "AAOIFI Shari'a Standard No. 28 — weapons and arms trade" },
  { keywords: ["narcotic", "illegal drug", "drug traffick"], citation: "AAOIFI Shari'a Standard No. 28 — drugs & narcotics" },
];

// ─── Mixed / potentially prohibited — always human review, never auto-decided ─
const MIXED_REVIEW_SECTORS: KeywordRule[] = [
  { keywords: ["grocery", "supermarket", "convenience store"], citation: "CBN NIFI policy note — general grocery/supermarket may stock alcohol or tobacco above the 5% revenue threshold" },
  { keywords: ["restaurant", "hospitality", "hotel", "catering"], citation: "CBN NIFI policy note — hospitality/restaurants may serve alcohol above the 5% revenue threshold" },
  { keywords: ["pharmac"], citation: "CBN NIFI policy note — pharmaceuticals may include haram ingredients; requires case-by-case KYB review" },
  { keywords: ["nightclub", "entertainment venue", "concert venue"], citation: "CBN NIFI policy note — entertainment venues may involve music/mixed-gender events (varies by madhab)" },
  { keywords: ["insurance"], citation: "CBN NIFI policy note — conventional insurance carries riba/gharar; must verify takaful-only structure" },
];

// ─── Permissible sectors (common Nigerian SME types) ────────────────────────
const PERMISSIBLE_SECTORS: KeywordRule[] = [
  { keywords: ["halal food", "food production", "food retail"], citation: "Permissible — halal food production & retail (halal certification must still be verified)" },
  { keywords: ["agricultur", "agro-process", "agro process", "crop farming", "poultry", "fisher"], citation: "Permissible — agriculture & agro-processing" },
  // "fabric" deliberately excluded — collides with unrelated words like "fabrication"
  { keywords: ["textile", "garment", "fashion", "tailoring"], citation: "Permissible — textile & garments" },
  { keywords: ["technology", "software", "it services", "mobile app"], citation: "Permissible — technology & software" },
  { keywords: ["healthcare", "medical clinic", "clinic"], citation: "Permissible — healthcare (excluding haram products)" },
  { keywords: ["construction", "real estate", "property development", "building"], citation: "Permissible — construction & real estate" },
  { keywords: ["education", "school", "tutoring", "skills training"], citation: "Permissible — education" },
  { keywords: ["manufactur"], citation: "Permissible — manufacturing (non-prohibited goods)" },
  { keywords: ["consulting", "legal services", "accounting", "professional services"], citation: "Permissible — professional services" },
  // Reference doc lists "Logistics & transport" under both Permissible (plain freight/haulage/delivery)
  // and Mixed ("if primary clients are prohibited businesses"). We have no client-base data to
  // evaluate that condition, so — matching the unconditional Permissible listing — transport/logistics
  // defaults to permissible here; revisit if/when KYB client-base evidence becomes available.
  { keywords: ["logistics", "freight", "haulage", "transport"], citation: "Permissible — transport & logistics (freight, haulage, delivery); flag manually if client base is known to be prohibited-sector)" },
  { keywords: ["renewable energy", "solar", "wind power"], citation: "Permissible — renewable energy (strongly encouraged in Islamic finance)" },
];

function matchKeywords(haystack: string, rules: KeywordRule[]): KeywordRule | undefined {
  return rules.find((rule) => rule.keywords.some((kw) => haystack.includes(kw)));
}

function classifyFinancingStructure(financingPurpose: string): ShariahClassification | undefined {
  const haystack = financingPurpose.toLowerCase();
  const hit = matchKeywords(haystack, PROHIBITED_STRUCTURES);
  if (!hit) return undefined;
  return { verdict: "NON_COMPLIANT", citation: hit.citation, matchedKeyword: hit.keywords[0] };
}

function classifySector(businessSector: string, businessActivity: string): ShariahClassification {
  const haystack = `${businessSector} ${businessActivity}`.toLowerCase();

  const prohibited = matchKeywords(haystack, PROHIBITED_SECTORS);
  if (prohibited) return { verdict: "NON_COMPLIANT", citation: prohibited.citation, matchedKeyword: prohibited.keywords[0] };

  const mixed = matchKeywords(haystack, MIXED_REVIEW_SECTORS);
  if (mixed) return { verdict: "REQUIRES_REVIEW", citation: mixed.citation, matchedKeyword: mixed.keywords[0] };

  const permissible = matchKeywords(haystack, PERMISSIBLE_SECTORS);
  if (permissible) return { verdict: "COMPLIANT", citation: permissible.citation, matchedKeyword: permissible.keywords[0] };

  // Fail-closed default: a sector this table has never seen is never
  // auto-classified either way.
  return {
    verdict: "REQUIRES_REVIEW",
    citation: "Sector/activity not found in the maintained Shariah policy table — requires Shariah officer review.",
  };
}

/**
 * Deterministic entry point. Financing-structure prohibitions are checked
 * first (they override any sector classification), then the sector table.
 */
export function classifyShariahCompliance(
  businessSector: string,
  businessActivity: string,
  financingPurpose: string,
): ShariahClassification {
  const structureHit = classifyFinancingStructure(financingPurpose);
  if (structureHit) return structureHit;
  return classifySector(businessSector, businessActivity);
}

/**
 * Purpose-only screen for Stage 6 (review gap G4, docs/platform-review-2026-07.md).
 *
 * The Stage 3 pre-check runs before a FinancingRequest exists, so the
 * Supervisor necessarily feeds classifyShariahCompliance a placeholder
 * purpose — meaning the structure prohibitions (refinancing, working
 * capital, cash advance) were never exercised against the business's REAL
 * stated purpose. This re-screens FinancingRequest.terms.purpose in the
 * Underwriting Agent's pipeline, checking:
 *  - prohibited financing STRUCTURES (the primary target), and
 *  - prohibited SECTOR keywords appearing in the purpose text itself
 *    (e.g. "purchase of beer inventory" from a business whose declared
 *    sector passed Stage 3 cleanly).
 *
 * Deliberately does NOT run the mixed/permissible sector tables against the
 * purpose: sector-level review already happened at Stage 3 on the real
 * sector/activity fields, and purpose prose matching a permissible keyword
 * clears nothing. Returns undefined when no prohibition matches — the
 * underwriting pipeline proceeds normally.
 */
export function classifyFinancingPurpose(financingPurpose: string): ShariahClassification | undefined {
  const structureHit = classifyFinancingStructure(financingPurpose);
  if (structureHit) return structureHit;
  const sectorHit = matchKeywords(financingPurpose.toLowerCase(), PROHIBITED_SECTORS);
  if (sectorHit) return { verdict: "NON_COMPLIANT", citation: sectorHit.citation, matchedKeyword: sectorHit.keywords[0] };
  return undefined;
}
