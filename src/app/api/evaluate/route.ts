import { NextRequest, NextResponse } from "next/server";
import { callTextAI } from "@/lib/ai-provider";

interface MisconceptionRule {
  expr: string;
  code: string;
  explanation: string;
}

interface EvaluatePayload {
  question_type: "expression" | "quantity" | "free_text";
  question_prompt?: string;
  student_answer: string;
  expected: string;
  unit?: string;
  tolerance?: number;
  sig_figs?: number;
  target_symbol?: string;
  misconceptions?: MisconceptionRule[];
}

const UNIT_FACTORS: Record<string, { base: string; factor: number }> = {
  // Current
  a: { base: "A", factor: 1 },
  ma: { base: "A", factor: 1e-3 },
  ua: { base: "A", factor: 1e-6 },
  "µa": { base: "A", factor: 1e-6 },
  ka: { base: "A", factor: 1e3 },
  // Voltage
  v: { base: "V", factor: 1 },
  mv: { base: "V", factor: 1e-3 },
  kv: { base: "V", factor: 1e3 },
  // Power
  w: { base: "W", factor: 1 },
  mw: { base: "W", factor: 1e-3 },
  kw: { base: "W", factor: 1e3 },
  // Energy
  j: { base: "J", factor: 1 },
  kj: { base: "J", factor: 1e3 },
  mj: { base: "J", factor: 1e6 },
  // Mass
  g: { base: "kg", factor: 1e-3 },
  kg: { base: "kg", factor: 1 },
  mg: { base: "kg", factor: 1e-6 },
  // Volume
  l: { base: "L", factor: 1 },
  ml: { base: "L", factor: 1e-3 },
  cm3: { base: "L", factor: 1e-3 },
  "cm^3": { base: "L", factor: 1e-3 },
  // Density
  "g/ml": { base: "g/mL", factor: 1 },
  "g/cm3": { base: "g/mL", factor: 1 },
  "g/cm^3": { base: "g/mL", factor: 1 },
  "kg/l": { base: "g/mL", factor: 1 },
  "kg/m3": { base: "g/mL", factor: 1e-3 },
  "kg/m^3": { base: "g/mL", factor: 1e-3 },
  // Mass concentration
  "g/l": { base: "g/L", factor: 1 },
  "g.l-1": { base: "g/L", factor: 1 },
  "g·l⁻¹": { base: "g/L", factor: 1 },
  "mg/l": { base: "g/L", factor: 1e-3 },
  // Amount of substance
  mol: { base: "mol", factor: 1 },
  mmol: { base: "mol", factor: 1e-3 },
  // Molar concentration
  "mol/l": { base: "mol/L", factor: 1 },
  "mol.l-1": { base: "mol/L", factor: 1 },
  "mol·l⁻¹": { base: "mol/L", factor: 1 },
  "mmol/l": { base: "mol/L", factor: 1e-3 },
  // Speed
  "m/s": { base: "m/s", factor: 1 },
  "m.s-1": { base: "m/s", factor: 1 },
  "m·s⁻¹": { base: "m/s", factor: 1 },
  "km/h": { base: "m/s", factor: 1 / 3.6 },
  // Time
  s: { base: "s", factor: 1 },
  ms: { base: "s", factor: 1e-3 },
  us: { base: "s", factor: 1e-6 },
  "µs": { base: "s", factor: 1e-6 },
  min: { base: "s", factor: 60 },
};

function normalize(raw: string): string {
  return raw
    .trim()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/⁰/g, "0")
    .replace(/¹/g, "1")
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/⁴/g, "4")
    .replace(/⁵/g, "5")
    .replace(/⁶/g, "6")
    .replace(/⁷/g, "7")
    .replace(/⁸/g, "8")
    .replace(/⁹/g, "9")
    .replace(/⁻/g, "-")
    .replace(/(\d(?:\.\d+)?)\s*\*\s*10\s*\^?\s*([+-]?\d+)/g, "$1e$2");
}

function countSigFigs(numStr: string): number {
  let s = numStr.trim().toLowerCase().split("e")[0].replace(/^[+-]/, "");
  if (s.includes(".")) {
    s = s.replace(/^0+/, "");
    if (s.startsWith(".")) s = s.slice(1).replace(/^0+/, "");
    else s = s.replace(".", "");
    return Math.max(s.length, 1);
  }
  s = s.replace(/^0+/, "").replace(/0+$/, "");
  return Math.max(s.length, 1);
}

// ============================================================
// Deterministic Symbolic-Numerical Algebraic Equivalence Engine
// Safely parses physics formulas (no eval) and verifies identity
// across 6 distinct test points, handling implicit multiplication
// (C V_A, RI, mg) and keyboard denominator shorthand (dx/vdt).
// ============================================================
type MathToken =
  | { kind: "num"; value: number }
  | { kind: "var"; name: string }
  | { kind: "op"; op: "+" | "-" | "*" | "/" | "^"; implicit?: boolean }
  | { kind: "lparen" }
  | { kind: "rparen" };

function extractVarCatalog(expr: string): string[] {
  const cleaned = expr.toLowerCase().replace(/\*\*/g, "^");
  const matches = cleaned.match(/[a-z][a-z0-9_]*(?:\([a-z0-9_]+\))?/g) || [];
  // Also strip function call arg if like x(t) -> x(t) and x
  const set = new Set<string>();
  for (const m of matches) {
    set.add(m);
    const base = m.replace(/\([a-z0-9_]+\)$/, "");
    if (base) set.add(base);
  }
  return Array.from(set).sort((a, b) => b.length - a.length);
}

function splitWordIntoVars(word: string, catalog: string[]): string[] | null {
  if (catalog.includes(word)) return [word];
  const result: string[] = [];
  let pos = 0;
  while (pos < word.length) {
    let matched: string | null = null;
    for (const v of catalog) {
      if (word.startsWith(v, pos)) {
        matched = v;
        break;
      }
    }
    if (!matched) return null;
    result.push(matched);
    pos += matched.length;
  }
  return result.length > 0 ? result : null;
}

function tokenizeFormula(expr: string, catalog: string[]): MathToken[] | null {
  const s = normalize(expr).toLowerCase().replace(/\*\*/g, "^").replace(/\s+/g, "");
  const rawTokens: MathToken[] = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (ch === "(") {
      rawTokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      rawTokens.push({ kind: "rparen" });
      i++;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "^") {
      rawTokens.push({ kind: "op", op: ch });
      i++;
      continue;
    }
    if (/\d|\./.test(ch)) {
      const m = s.slice(i).match(/^\d+(?:\.\d+)?(?:e[+-]?\d+)?/);
      if (!m) return null;
      rawTokens.push({ kind: "num", value: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-z]/.test(ch)) {
      const m = s.slice(i).match(/^[a-z][a-z0-9_]*/);
      if (!m) return null;
      const word = m[0];
      // Check if followed by "(arg)" matching a catalog symbol like x(t) or n_i(acide)
      let fullWord = word;
      if (s[i + word.length] === "(") {
        const argMatch = s.slice(i + word.length).match(/^\([a-z0-9_]+\)/);
        if (argMatch && catalog.includes(word + argMatch[0])) {
          fullWord = word + argMatch[0];
        }
      }
      const split = splitWordIntoVars(fullWord, catalog);
      if (split) {
        for (const v of split) rawTokens.push({ kind: "var", name: v });
      } else {
        rawTokens.push({ kind: "var", name: fullWord });
      }
      i += fullWord.length;
      continue;
    }
    return null; // Unsupported character
  }

  // Insert implicit multiplication tokens where adjacent values/parens meet
  const out: MathToken[] = [];
  for (let idx = 0; idx < rawTokens.length; idx++) {
    const curr = rawTokens[idx];
    if (out.length > 0) {
      const prev = out[out.length - 1];
      const prevIsVal = prev.kind === "num" || prev.kind === "var" || prev.kind === "rparen";
      const currIsVal = curr.kind === "num" || curr.kind === "var" || curr.kind === "lparen";
      if (prevIsVal && currIsVal) {
        out.push({ kind: "op", op: "*", implicit: true });
      }
    }
    out.push(curr);
  }
  return out;
}

function evaluateTokens(
  tokens: MathToken[],
  env: Record<string, number>,
  tightImplicitMul: boolean
): number | null {
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseAddSub(): number {
    let left = parseMulDiv();
    while (peek()?.kind === "op" && (peek() as { op: string }).op.match(/^[+-]$/)) {
      const op = (consume() as { op: "+" | "-" }).op;
      const right = parseMulDiv();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseMulDiv(): number {
    let left = tightImplicitMul ? parseImplicitMul() : parseUnary();
    while (
      peek()?.kind === "op" &&
      ((peek() as { op: string; implicit?: boolean }).op === "*" ||
        (peek() as { op: string; implicit?: boolean }).op === "/") &&
      !(tightImplicitMul && (peek() as { implicit?: boolean }).implicit)
    ) {
      const op = (consume() as { op: "*" | "/" }).op;
      const right = tightImplicitMul ? parseImplicitMul() : parseUnary();
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  function parseImplicitMul(): number {
    let left = parseUnary();
    while (
      peek()?.kind === "op" &&
      (peek() as { op: string; implicit?: boolean }).op === "*" &&
      (peek() as { implicit?: boolean }).implicit
    ) {
      consume();
      left *= parseUnary();
    }
    return left;
  }

  function parseUnary(): number {
    if (peek()?.kind === "op" && ((peek() as { op: string }).op === "+" || (peek() as { op: string }).op === "-")) {
      const op = (consume() as { op: "+" | "-" }).op;
      const val = parseUnary();
      return op === "-" ? -val : val;
    }
    return parsePow();
  }

  function parsePow(): number {
    const base = parsePrimary();
    if (peek()?.kind === "op" && (peek() as { op: string }).op === "^") {
      consume();
      const exp = parseUnary();
      return Math.pow(base, exp);
    }
    return base;
  }

  function parsePrimary(): number {
    const tok = consume();
    if (!tok) throw new Error("EOF");
    if (tok.kind === "num") return tok.value;
    if (tok.kind === "var") {
      if (!(tok.name in env)) throw new Error("Unknown var");
      return env[tok.name];
    }
    if (tok.kind === "lparen") {
      const val = parseAddSub();
      if (peek()?.kind !== "rparen") throw new Error("Missing )");
      consume();
      return val;
    }
    throw new Error("Unexpected token");
  }

  try {
    const val = parseAddSub();
    if (pos !== tokens.length || !Number.isFinite(val)) return null;
    return val;
  } catch {
    return null;
  }
}

function checkSymbolicEquivalence(
  studentRhs: string,
  expectedRhs: string
): "exact" | "denominator_parens" | "different" {
  const catalog = extractVarCatalog(expectedRhs);
  const expTokens = tokenizeFormula(expectedRhs, catalog);
  const stuTokens = tokenizeFormula(studentRhs, catalog);
  if (!expTokens || !stuTokens || expTokens.length === 0 || stuTokens.length === 0) {
    return "different";
  }

  // Collect all variables across both expressions
  const allVars = Array.from(
    new Set([
      ...expTokens.filter((t): t is { kind: "var"; name: string } => t.kind === "var").map((t) => t.name),
      ...stuTokens.filter((t): t is { kind: "var"; name: string } => t.kind === "var").map((t) => t.name),
    ])
  );

  // Deterministic pseudo-random positive test vectors (no zero-division, non-commensurate values)
  const testWithMode = (tightImplicitMul: boolean): boolean => {
    for (let trial = 0; trial < 6; trial++) {
      const env: Record<string, number> = {};
      allVars.forEach((v, idx) => {
        env[v] = 1.37 + ((idx + 1) * 1.91 + trial * 2.73) % 7.89 + (idx * 0.173);
      });
      const eVal = evaluateTokens(expTokens, env, false);
      const sVal = evaluateTokens(stuTokens, env, tightImplicitMul);
      if (eVal === null || sVal === null) return false;
      const denom = Math.max(Math.abs(eVal), 1e-9);
      if (Math.abs(eVal - sVal) / denom > 1e-5) return false;
    }
    return true;
  };

  if (testWithMode(false)) return "exact";
  if (testWithMode(true)) return "denominator_parens";
  return "different";
}

function fallbackEvaluate(body: EvaluatePayload) {
  const raw = normalize(body.student_answer || "");
  const expectedDisplay = body.unit ? `${body.expected.replace(".", ",")} ${body.unit}` : body.expected;

  if (!raw) {
    return {
      status: "unreadable",
      score: 0,
      max_score: 1,
      explanation: "Ta réponse est vide. Saisis une réponse avant de valider.",
      expected_display: expectedDisplay,
      engine: "ts_fallback",
    };
  }

  if (body.question_type === "expression") {
    const compact = raw.replace(/\s+/g, "").toLowerCase();
    const expectedCompact = normalize(body.expected).replace(/\s+/g, "").toLowerCase();
    const target = (body.target_symbol || "").toLowerCase();

    const stripTarget = (s: string) => {
      if (target && s.startsWith(`${target}=`)) return s.slice(target.length + 1);
      if (target && s.endsWith(`=${target}`)) return s.slice(0, -(target.length + 1));
      // Also strip generic LHS like "n_i(acide)=" or "v(t)=" when expected has one
      if (s.includes("=")) {
        const parts = s.split("=");
        if (parts.length === 2) return parts[1];
      }
      return s;
    };

    const studentRhs = stripTarget(compact);
    const expectedRhs = stripTarget(expectedCompact);

    if (compact === expectedCompact || studentRhs === expectedRhs) {
      return {
        status: "correct",
        score: 1,
        max_score: 1,
        explanation: "Correct ! Expression littérale équivalente à la relation attendue.",
        expected_display: expectedDisplay,
        engine: "ts_symbolic",
      };
    }

    // Deterministic algebraic equivalence check across 6 test points
    const symEq = checkSymbolicEquivalence(studentRhs, expectedRhs);
    if (symEq === "exact") {
      return {
        status: "correct",
        score: 1,
        max_score: 1,
        explanation: "Correct ! Ton écriture est algébriquement équivalente à la formule attendue.",
        expected_display: expectedDisplay,
        engine: "ts_symbolic",
      };
    }
    if (symEq === "denominator_parens") {
      return {
        status: "partially_correct",
        score: 0.9,
        max_score: 1,
        error_code: "erreur_notation",
        error_category: "Communication",
        explanation:
          "Bonne relation physique ! Pense à ajouter des parenthèses au dénominateur (et à respecter les majuscules/minuscules des grandeurs) pour éviter toute ambiguïté d'écriture.",
        expected_display: expectedDisplay,
        engine: "ts_symbolic",
      };
    }

    // Equivalent un-isolated equation check for Ohm's law
    if (
      expectedRhs === "u/r" &&
      ["u=r*i", "u=i*r", "u=ri", "u=ir", "r*i=u", "i*r=u", "r=u/i"].includes(compact)
    ) {
      return {
        status: "partially_correct",
        score: 0.7,
        max_score: 1,
        error_code: "variable_non_isolee",
        error_category: "Algébrique",
        explanation: `Ta relation est juste, mais la consigne demande d'isoler ${body.target_symbol || "I"}.`,
        expected_display: expectedDisplay,
        engine: "ts_fallback",
      };
    }

    for (const m of body.misconceptions || []) {
      const mCompact = normalize(m.expr).replace(/\s+/g, "").toLowerCase();
      if (studentRhs === mCompact || compact === mCompact) {
        return {
          status: "incorrect",
          score: 0,
          max_score: 1,
          error_code: m.code,
          error_category: "Algébrique",
          explanation: m.explanation,
          expected_display: expectedDisplay,
          engine: "ts_fallback",
        };
      }
    }

    return {
      status: "incorrect",
      score: 0,
      max_score: 1,
      error_code: "expression_incorrecte",
      error_category: "Sélection de formule",
      explanation: "L'expression ne correspond pas à la relation attendue. Repars de la loi fondamentale du chapitre.",
      expected_display: expectedDisplay,
      engine: "ts_fallback",
    };
  }

  // Quantity evaluation
  const match = raw.match(/^\s*([+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*(.*)$/i);
  if (!match) {
    return {
      status: "unreadable",
      score: 0,
      max_score: 1,
      explanation: "Je n'arrive pas à lire cette valeur. Écris un nombre suivi de son unité (ex : 0,26 A ou 260 mA).",
      expected_display: expectedDisplay,
      engine: "ts_fallback",
    };
  }

  const numStr = match[1];
  const studentUnitRaw = match[2].trim();
  const studentVal = parseFloat(numStr);
  const expectedVal = parseFloat(normalize(body.expected));
  const tol = body.tolerance ?? 0.03;

  if (body.unit && !studentUnitRaw) {
    const relErr = Math.abs(studentVal - expectedVal) / Math.max(Math.abs(expectedVal), 1e-12);
    if (relErr <= tol) {
      return {
        status: "partially_correct",
        score: 0.75,
        max_score: 1,
        error_code: "unite_manquante",
        error_category: "Unité / conversion",
        explanation: `Valeur numérique correcte, mais l'unité (${body.unit}) est manquante !`,
        expected_display: expectedDisplay,
        engine: "ts_fallback",
      };
    }
    if (Math.abs(studentVal - expectedVal * 1000) / Math.max(Math.abs(expectedVal * 1000), 1e-12) <= 0.05) {
      return {
        status: "incorrect",
        score: 0.25,
        max_score: 1,
        error_code: "conversion_unites",
        error_category: "Unité / conversion",
        explanation: `${numStr} est la valeur en m${body.unit}, pas en ${body.unit}. Divise par 1000 et précise l'unité.`,
        expected_display: expectedDisplay,
        engine: "ts_fallback",
      };
    }
  }

  let converted = studentVal;
  if (body.unit && studentUnitRaw) {
    const stuInfo = UNIT_FACTORS[studentUnitRaw.toLowerCase()];
    const expInfo = UNIT_FACTORS[body.unit.toLowerCase()];
    if (!stuInfo || !expInfo) {
      return {
        status: "unreadable",
        score: 0,
        max_score: 1,
        explanation: `Unité « ${studentUnitRaw} » non reconnue. Utilise par exemple A, mA, V, kg, g.`,
        expected_display: expectedDisplay,
        engine: "ts_fallback",
      };
    }
    if (stuInfo.base !== expInfo.base) {
      return {
        status: "incorrect",
        score: 0,
        max_score: 1,
        error_code: "unite_incompatible",
        error_category: "Unité / conversion",
        explanation: `L'unité « ${studentUnitRaw} » n'est pas homogène à ${body.unit}.`,
        expected_display: expectedDisplay,
        engine: "ts_fallback",
      };
    }
    converted = (studentVal * stuInfo.factor) / expInfo.factor;
  }

  const relErr = Math.abs(converted - expectedVal) / Math.max(Math.abs(expectedVal), 1e-12);
  if (relErr <= tol) {
    if (body.sig_figs !== undefined) {
      const sf = countSigFigs(numStr);
      if (sf !== body.sig_figs) {
        return {
          status: "partially_correct",
          score: 0.85,
          max_score: 1,
          error_code: "chiffres_significatifs",
          error_category: "Chiffres significatifs",
          explanation: `Valeur et unité exactes ! Mais la consigne demande ${body.sig_figs} chiffres significatifs (tu en as donné ${sf}).`,
          expected_display: expectedDisplay,
          engine: "ts_fallback",
        };
      }
    }
    return {
      status: "correct",
      score: 1,
      max_score: 1,
      explanation: "Exact ! Valeur, conversion d'unité et chiffres significatifs validés.",
      expected_display: expectedDisplay,
      engine: "ts_fallback",
    };
  }

  if (Math.abs(converted - expectedVal * 1000) / Math.max(Math.abs(expectedVal * 1000), 1e-12) <= 0.05) {
    return {
      status: "incorrect",
      score: 0.25,
      max_score: 1,
      error_code: "conversion_unites",
      error_category: "Unité / conversion",
      explanation: `Erreur d'un facteur 1000 : vérifie ta conversion d'unité vers ${body.unit || "l'unité demandée"}.`,
      expected_display: expectedDisplay,
      engine: "ts_fallback",
    };
  }

  return {
    status: "incorrect",
    score: 0,
    max_score: 1,
    error_code: "erreur_calcul",
    error_category: "Calcul",
    explanation: "Le calcul ne correspond pas au résultat attendu. Vérifie ton application numérique.",
    expected_display: expectedDisplay,
    engine: "ts_fallback",
  };
}

export async function POST(req: NextRequest) {
  let body: EvaluatePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // Open-ended / justification questions: evaluate via AI rubric (Vision Doc §7.1)
  if (body.question_type === "free_text") {
    if (!body.student_answer?.trim()) {
      return NextResponse.json({
        status: "unreadable",
        score: 0,
        max_score: 1,
        explanation: "Ta réponse est vide. Rédige une courte justification ou explication.",
        expected_display: body.expected,
        engine: "ai_rubric",
      });
    }

    const aiRes = await callTextAI({
      system:
        "Tu es un correcteur de Physique-Chimie au lycée français. Évalue la réponse rédigée par l'élève par rapport au corrigé attendu. " +
        'Retourne UNIQUEMENT un JSON valide : {"status":"correct"|"partially_correct"|"incorrect","score":0.0..1.0,"error_category":null|"Conceptuel"|"Méthodologie"|"Communication","explanation":"explication pédagogique courte en français"}',
      messages: [
        {
          role: "user",
          content: `Question : ${body.question_prompt || ""}\nAttendu / barème : ${body.expected}\nRéponse de l'élève : ${body.student_answer}`,
        },
      ],
      maxTokens: 800,
      jsonMode: true,
    });

    if (aiRes?.text) {
      const m = aiRes.text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const parsed = JSON.parse(m[0]);
          return NextResponse.json({
            status: parsed.status || "partially_correct",
            score: Math.min(1, Math.max(0, Number(parsed.score ?? 0.5))),
            max_score: 1,
            error_category: parsed.error_category || undefined,
            explanation: parsed.explanation || "Réponse évaluée par rapport au barème.",
            expected_display: body.expected,
            engine: `ai_rubric_${aiRes.provider}`,
          });
        } catch {
          // fallback below
        }
      }
    }

    return NextResponse.json({
      status: "partially_correct",
      score: 0.5,
      max_score: 1,
      explanation: "Réponse enregistrée. Compare tes arguments avec les points clés attendus ci-dessous.",
      expected_display: body.expected,
      engine: "ai_rubric_fallback",
    });
  }

  // Auto-detect when an AI-generated "Grandeur" question actually expects a symbolic formula (e.g., "n_i(acide) = C * V_A")
  if (body.question_type === "quantity") {
    const normExp = normalize(body.expected || "");
    const looksPureNumber = /^[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?\s*[a-zA-Z°µΩ/·^0-9-]*$/.test(
      normExp
    ) && !/[=]/.test(normExp) && /^\s*[+-]?\d/.test(normExp);
    if (!looksPureNumber) {
      body = { ...body, question_type: "expression" };
    }
  }

  const serviceUrl = process.env.EVALUATION_SERVICE_URL || "http://127.0.0.1:8000";

  // Try real Python FastAPI (SymPy + Pint) evaluation microservice first
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`${serviceUrl}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Microservice offline — seamlessly use built-in fallback evaluator
  }

  const result = fallbackEvaluate(body);

  // If deterministic expression comparison didn't match (and wasn't a known misconception),
  // verify algebraic/physical equivalence via AI (handles rearranged forms, dx/Vdt vs (1/V)*(dx/dt), etc.)
  if (
    body.question_type === "expression" &&
    result.status === "incorrect" &&
    result.error_code === "expression_incorrecte"
  ) {
    const aiCheck = await callTextAI({
      system:
        "Tu es un moteur de vérification d'équivalence algébrique et physique (Physique-Chimie lycée français). " +
        "Compare la formule de l'élève à la formule attendue. " +
        "RÈGLES : " +
        "1) Accepte toute écriture mathématiquement/physiquement équivalente (ex: C*V_A == V_A*C, dx/(V*dt) == (1/V)*(dx/dt), multiplication implicite, espaces, casse mineure comme v vs V si non ambiguë). " +
        "2) Si l'élève écrit un raccourci courant physiquement juste mais avec une petite imprécision de parenthèses ou de casse (ex: dx/vdt pour (1/V)*(dx/dt)), accorde 'correct' (score 1.0) ou 'partially_correct' (score 0.9) avec un conseil gentil de rigueur. " +
        "3) Marque 'incorrect' (score 0.0) UNIQUEMENT si la physique/l'algèbre est réellement fausse (formule inversée, signe faux, variable manquante ou erronée). " +
        'Retourne UNIQUEMENT un JSON valide : {"status":"correct"|"partially_correct"|"incorrect","score":0.0..1.0,"error_code":null|"formule_inversee"|"erreur_notation"|"expression_incorrecte","error_category":null|"Algébrique"|"Communication"|"Sélection de formule","explanation":"explication courte et claire en français"}',
      messages: [
        {
          role: "user",
          content: `Question : ${body.question_prompt || ""}\nFormule attendue : ${body.expected}\nRéponse de l'élève : ${body.student_answer}`,
        },
      ],
      maxTokens: 800,
      jsonMode: true,
    });

    if (aiCheck?.text) {
      const m = aiCheck.text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const parsed = JSON.parse(m[0]);
          return NextResponse.json({
            status: parsed.status || result.status,
            score: Math.min(1, Math.max(0, Number(parsed.score ?? result.score))),
            max_score: 1,
            error_code: parsed.error_code || undefined,
            error_category: parsed.error_category || undefined,
            explanation: parsed.explanation || result.explanation,
            expected_display: body.expected,
            engine: `algebra_ai_${aiCheck.provider}`,
          });
        } catch {
          // keep deterministic result
        }
      }
    }
  }

  return NextResponse.json(result);
}
